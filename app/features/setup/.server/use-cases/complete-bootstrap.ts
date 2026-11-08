import { deriveServerAuthHash, generateServerSalt } from '../../../../lib/.server/auth-hash';
import { recordAuditEvent } from '../../../../lib/.server/audit';
import { createFirstAdmin, isBootstrapAvailable } from '../../../../lib/.server/bootstrap';
import { getDatabase } from '../../../../lib/.server/db';
import { requireSecret } from '../../../../lib/.server/env';
import { createSession, destroySession } from '../../../../lib/.server/session';
import type { SetupInput } from '../setup-input';

export type CompleteBootstrapResult =
  { status: 'created'; cookie: string } | { status: 'exists' } | { status: 'server-error' };

export const completeBootstrap = async (env: Env, input: SetupInput): Promise<CompleteBootstrapResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const db = getDatabase(env);
  if (!(await isBootstrapAvailable(db))) {
    return { status: 'exists' };
  }

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const serverAuthHash = await deriveServerAuthHash(input.authHashBytes, generateServerSalt(), pepper);

  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    session = await createSession(env, id);
  } catch {
    return { status: 'server-error' };
  }

  let created: Awaited<ReturnType<typeof createFirstAdmin>>;
  try {
    created = await createFirstAdmin(db, {
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
      createdAt,
    });
  } catch {
    await destroySession(env, session.token).catch(() => undefined);
    return { status: 'server-error' };
  }

  if (created === 'exists') {
    await destroySession(env, session.token).catch(() => undefined);
    return { status: 'exists' };
  }

  try {
    await recordAuditEvent(db, { type: 'bootstrap.created', userId: id, createdAt });
  } catch {
    console.warn('bootstrap.audit_failed');
  }

  return { status: 'created', cookie: session.cookie };
};
