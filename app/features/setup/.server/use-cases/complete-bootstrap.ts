import { deriveServerAuthHash, generateServerSalt } from '../../../../lib/.server/auth-hash';
import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { readConfig } from '../../../../lib/.server/env';
import { requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints, fingerprintRequest } from '../../../../lib/.server/request-fingerprint';
import { createSession, destroySessionToken } from '../../../../lib/.server/session';
import { invalidateSetupState } from '../../../../lib/.server/setup-guard';
import type { SetupInput } from '../setup-input';

export type CompleteBootstrapResult =
  { status: 'created'; cookie: string } | { status: 'exists' } | { status: 'server-error' };

export const completeBootstrap = async (
  env: Env,
  input: SetupInput,
  request?: Request,
): Promise<CompleteBootstrapResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const users = createUsersQueries(env);
  if ((await users.count()) !== 0) {
    return { status: 'exists' };
  }

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const serverAuthHash = await deriveServerAuthHash(input.authHashBytes, generateServerSalt(), pepper);
  const recoveryAuthHash = await deriveServerAuthHash(input.recoveryAuthKeyBytes, generateServerSalt(), pepper);

  const sessionSecret = readConfig(env, 'SESSION_SECRET');
  const fingerprints =
    request && sessionSecret ? await fingerprintRequest(request, sessionSecret) : { uaHash: null, ipHash: null };

  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    session = await createSession(env, { userId: id, ver: 0, ...fingerprints });
  } catch {
    return { status: 'server-error' };
  }

  let created: 'created' | 'exists';
  try {
    created = await users.createFirstAdmin({
      id,
      email: input.email,
      displayName: input.displayName,
      authHash: serverAuthHash.authHash,
      serverSalt: serverAuthHash.serverSalt,
      kdfIterations: input.kdfIterations,
      kdfSalt: input.kdfSalt,
      vaultKeyWrapped: input.vaultKeyWrapped,
      vaultKeyWrapIv: input.vaultKeyWrapIv,
      recoveryKeyWrapped: input.recoveryKeyWrapped,
      recoveryKeyWrapIv: input.recoveryKeyWrapIv,
      recoveryAuthHash: recoveryAuthHash.authHash,
      recoveryServerSalt: recoveryAuthHash.serverSalt,
      createdAt,
    });
  } catch {
    await destroySessionToken(env, session.token).catch(() => undefined);
    return { status: 'server-error' };
  }

  if (created === 'exists') {
    await destroySessionToken(env, session.token).catch(() => undefined);
    return { status: 'exists' };
  }

  await invalidateSetupState(env);
  await recordAuditEventSafe(env, {
    type: 'bootstrap.created',
    userId: id,
    createdAt,
    ...(request ? await auditFingerprints(env, request) : {}),
  });

  return { status: 'created', cookie: session.cookie };
};
