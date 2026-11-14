import { deriveServerAuthHash, generateServerSalt } from '../../../../lib/.server/auth-hash';
import { base64UrlToStandard } from '../../../../lib/base64-url';
import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { requireSecret } from '../../../../lib/.server/env';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { createSession, destroySessionToken, readSessionToken } from '../../../../lib/.server/session';
import { LOCKOUT_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from '../../../../lib/.server/constants/auth';
import { verifyPasswordProof } from '../../../../lib/.server/password-proof';
import type { PasswordChangeInput } from '../password-input';

export type ChangePasswordResult =
  | { status: 'ok'; cookie: string }
  | { status: 'invalid-current' }
  | { status: 'locked'; retryAfter: number }
  | { status: 'server-error' };

export const changeMasterPassword = async (
  env: Env,
  request: Request,
  userId: string,
  input: PasswordChangeInput,
): Promise<ChangePasswordResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const users = createUsersQueries(env);
  const current = await users.findPasswordChangeState(userId);
  if (!current || current.status !== 'active') return { status: 'invalid-current' };
  const now = Date.now();
  const result = await verifyPasswordProof({
    authHashBytes: input.currentAuthHashBytes,
    serverSalt: current.server_salt,
    pepper,
    expectedHash: current.auth_hash,
    lockedUntil: current.locked_until,
    now,
    maxAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
    recordFailure: async () => {
      const state = await users.recordFailedLogin(userId, now, MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
      return state ? { failed_count: state.failed_login_count, locked_until: state.locked_until } : null;
    },
    resetFailures: () => users.resetLoginFailures(userId, now),
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

  const serverHash = await deriveServerAuthHash(input.authHashBytes, generateServerSalt(), pepper);
  const update = await users.rotatePassword(
    userId,
    {
      authHash: serverHash.authHash,
      serverSalt: serverHash.serverSalt,
      kdfSalt: base64UrlToStandard(input.kdfSalt),
      kdfIterations: input.kdfIterations,
      vaultKeyWrapped: base64UrlToStandard(input.vaultKeyWrapped),
      vaultKeyWrapIv: base64UrlToStandard(input.vaultKeyWrapIv),
    },
    Date.now(),
    current.auth_hash,
    current.server_salt,
  );
  if (update.meta.changes !== 1) return { status: 'invalid-current' };

  const rotated = await users.findPasswordChangeState(userId);
  if (!rotated) return { status: 'server-error' };

  let session: Awaited<ReturnType<typeof createSession>>;
  const fingerprints = await auditFingerprints(env, request);
  try {
    session = await createSession(env, { userId, ver: rotated.session_version, ...fingerprints });
  } catch {
    return { status: 'server-error' };
  }

  const oldToken = readSessionToken(request);
  if (oldToken) await destroySessionToken(env, oldToken).catch(() => undefined);

  await recordAuditEventSafe(env, { type: 'password.changed', userId, createdAt: Date.now(), ...fingerprints });
  return { status: 'ok', cookie: session.cookie };
};
