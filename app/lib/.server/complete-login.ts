import { standardToBase64Url } from '../base64-url';
import { recordAuditEventSafe } from './audit';
import { createUsersQueries } from './queries/users';
import { requireSecret } from './env';
import { auditFingerprints, fingerprintRequest } from './request-fingerprint';
import { createSession, type CreatedSession } from './session';

export type LoginSuccessBody = {
  requires2fa: false;
  kdfAlg: 'pbkdf2-sha256';
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
};

export type CompletedLogin = {
  status: 'ok';
  body: LoginSuccessBody;
  cookie: string;
};

export const completeLogin = async (
  env: Env,
  request: Request,
  userId: string,
): Promise<CompletedLogin | { status: 'server-error' }> => {
  let sessionSecret: string;
  try {
    sessionSecret = requireSecret(env, 'SESSION_SECRET');
  } catch {
    return { status: 'server-error' };
  }

  const users = createUsersQueries(env);
  const row = await users.findLoginCompletion(userId);

  if (!row || row.status !== 'active') return { status: 'server-error' };

  let body: LoginSuccessBody;
  try {
    body = {
      requires2fa: false,
      kdfAlg: row.kdf_alg,
      kdfSalt: standardToBase64Url(row.kdf_salt),
      kdfIterations: row.kdf_iterations,
      vaultKeyWrapped: standardToBase64Url(row.vault_key_wrapped),
      vaultKeyWrapIv: standardToBase64Url(row.vault_key_wrap_iv),
    };
  } catch {
    return { status: 'server-error' };
  }

  const fingerprints = await fingerprintRequest(request, sessionSecret);
  let session: CreatedSession;
  try {
    session = await createSession(env, {
      userId: row.id,
      ver: row.session_version,
      ...fingerprints,
    });
  } catch {
    return { status: 'server-error' };
  }

  await recordAuditEventSafe(env, {
    type: 'login.succeeded',
    userId: row.id,
    createdAt: Date.now(),
    ...(await auditFingerprints(env, request)),
  });

  return { status: 'ok', body, cookie: session.cookie };
};
