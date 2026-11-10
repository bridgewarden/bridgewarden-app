import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { deriveServerAuthHash, generateServerSalt } from '../../../../lib/.server/auth-hash';
import { requireSecret } from '../../../../lib/.server/env';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { createUserTwoFactorQueries } from '../../../../lib/.server/queries/user-two-factor';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { createSession } from '../../../../lib/.server/session';
import { verifyServerAuthHash } from '../../../../lib/.server/verify-auth';
import type { RecoveryResetInput } from '../recovery-input';

export type RecoveryResetResult =
  { status: 'ok'; cookie: string } | { status: 'committed' } | { status: 'invalid' } | { status: 'server-error' };

export const resetWithRecovery = async (
  env: Env,
  request: Request,
  input: RecoveryResetInput,
): Promise<RecoveryResetResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const users = createUsersQueries(env);
  const state = await users.findRecoveryState(input.email);
  const fingerprints = await auditFingerprints(env, request);

  if (
    !state ||
    state.status !== 'active' ||
    !state.recovery_auth_hash ||
    !state.recovery_server_salt ||
    !(await verifyServerAuthHash(
      input.currentRecoveryAuthKeyBytes,
      state.recovery_server_salt,
      pepper,
      state.recovery_auth_hash,
    ))
  ) {
    await recordAuditEventSafe(env, {
      type: 'recovery.failed',
      userId: state?.id ?? null,
      createdAt: Date.now(),
      ...fingerprints,
    });
    return { status: 'invalid' };
  }

  const auth = await deriveServerAuthHash(input.authHashBytes, generateServerSalt(), pepper);
  const recovery = await deriveServerAuthHash(input.recoveryAuthKeyBytes, generateServerSalt(), pepper);
  const update = await users.resetRecovery(
    state.id,
    {
      authHash: auth.authHash,
      serverSalt: auth.serverSalt,
      kdfSalt: input.kdfSalt,
      kdfIterations: input.kdfIterations,
      vaultKeyWrapped: input.vaultKeyWrapped,
      vaultKeyWrapIv: input.vaultKeyWrapIv,
      recoveryKeyWrapped: input.recoveryKeyWrapped,
      recoveryKeyWrapIv: input.recoveryKeyWrapIv,
      recoveryAuthHash: recovery.authHash,
      recoveryServerSalt: recovery.serverSalt,
    },
    Date.now(),
    state.recovery_auth_hash,
    state.recovery_server_salt,
  );

  if (update.meta.changes !== 1) {
    await recordAuditEventSafe(env, {
      type: 'recovery.failed',
      userId: state.id,
      createdAt: Date.now(),
      ...fingerprints,
    });
    return { status: 'invalid' };
  }

  const rotated = await users.findSessionUser(state.id);
  if (!rotated) return { status: 'committed' };

  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    session = await createSession(env, { userId: state.id, ver: rotated.sessionVersion, ...fingerprints });
  } catch {
    return { status: 'committed' };
  }

  await recordAuditEventSafe(env, {
    type: 'recovery.completed',
    userId: state.id,
    createdAt: Date.now(),
    ...fingerprints,
  });

  if (await createUserTwoFactorQueries(env).isEnabled(state.id)) {
    await recordAuditEventSafe(env, {
      type: 'recovery.completed_2fa_bypassed',
      userId: state.id,
      createdAt: Date.now(),
      ...fingerprints,
    });
  }

  return { status: 'ok', cookie: session.cookie };
};
