import { storedToBase64Url } from '../../../../lib/base64-url';
import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { verifyPasswordProof } from '../../../../lib/.server/password-proof';
import { LOCKOUT_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from '../../../../lib/.server/constants/auth';

export type PreparePasswordChangeResult =
  | {
      status: 'ok';
      material: { kdfSalt: string; kdfIterations: number; vaultKeyWrapped: string; vaultKeyWrapIv: string };
    }
  | { status: 'invalid-current' }
  | { status: 'locked'; retryAfter: number }
  | { status: 'server-error' };

export const preparePasswordChange = async (
  env: Env,
  request: Request,
  userId: string,
  currentAuthHashBytes: Uint8Array,
): Promise<PreparePasswordChangeResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const users = createUsersQueries(env);
  const state = await users.findPasswordChangeState(userId);
  if (!state || state.status !== 'active') return { status: 'server-error' };

  const now = Date.now();
  const result = await verifyPasswordProof({
    authHashBytes: currentAuthHashBytes,
    serverSalt: state.server_salt,
    pepper,
    expectedHash: state.auth_hash,
    lockedUntil: state.locked_until,
    now,
    maxAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
    recordFailure: async () => {
      const state = await users.recordFailedLogin(userId, now, MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
      return state ? { failed_count: state.failed_login_count, locked_until: state.locked_until } : null;
    },
    resetFailures: () => users.resetLoginFailures(userId, Date.now()),
    onFailure: async () => {
      await recordAuditEventSafe(env, {
        type: 'password.change_failed',
        userId,
        createdAt: now,
        ...(await auditFingerprints(env, request)),
      });
    },
  });
  if (result.status !== 'ok') {
    return result.status === 'invalid-password' ? { status: 'invalid-current' } : result;
  }

  return {
    status: 'ok',
    material: {
      kdfSalt: storedToBase64Url(state.kdf_salt),
      kdfIterations: state.kdf_iterations,
      vaultKeyWrapped: storedToBase64Url(state.vault_key_wrapped),
      vaultKeyWrapIv: storedToBase64Url(state.vault_key_wrap_iv),
    },
  };
};
