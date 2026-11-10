import { storedToBase64Url } from '../../../../lib/base64-url';
import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { verifyServerAuthHash } from '../../../../lib/.server/verify-auth';
import { LOCKOUT_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from '../../../login/.server/constants/auth';

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
  if (state.locked_until && state.locked_until > now) {
    return { status: 'locked', retryAfter: Math.ceil((state.locked_until - now) / 1000) };
  }

  if (!(await verifyServerAuthHash(currentAuthHashBytes, state.server_salt, pepper, state.auth_hash))) {
    const failure = await users.recordFailedLogin(userId, now, MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
    await recordAuditEventSafe(env, {
      type: 'password.change_failed',
      userId,
      createdAt: now,
      ...(await auditFingerprints(env, request)),
    });
    return failure?.locked_until && failure.failed_login_count >= MAX_FAILED_LOGIN_ATTEMPTS
      ? { status: 'locked', retryAfter: Math.ceil((failure.locked_until - now) / 1000) }
      : { status: 'invalid-current' };
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
