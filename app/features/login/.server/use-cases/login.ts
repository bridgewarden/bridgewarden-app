import { standardToBase64Url } from '../../../../lib/base64-url';
import { KEY_BYTES, SALT_BYTES } from '../../../../lib/crypto/contract';
import { encodeBase64 } from '../../../../lib/crypto/encoding';
import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { getDatabase } from '../../../../lib/.server/db';
import { requireSecret } from '../../../../lib/.server/env';
import { hmacSha256 } from '../../../../lib/.server/hmac';
import { fingerprintRequest } from '../../../../lib/.server/request-fingerprint';
import { createSession, type CreatedSession } from '../../../../lib/.server/session';
import { verifyServerAuthHash } from '../../../../lib/.server/verify-auth';
import type { LoginInput } from '../login-input';

type UserRow = {
  id: string;
  auth_hash: string;
  server_salt: string;
  kdf_alg: 'pbkdf2-sha256';
  kdf_salt: string;
  kdf_iterations: number;
  vault_key_wrapped: string;
  vault_key_wrap_iv: string;
  status: 'active' | 'disabled';
  session_version: number;
};

export type LoginResponse = {
  requires2fa: false;
  kdfAlg: 'pbkdf2-sha256';
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
};

export type LoginResult =
  | { status: 'ok'; body: LoginResponse; cookie: string }
  | { status: 'invalid-credentials' }
  | { status: 'server-error' };

const auditFailure = async (env: Env, request: Request, userId: string | null, secret: string): Promise<void> => {
  const fingerprints = await fingerprintRequest(request, secret);

  await recordAuditEventSafe(getDatabase(env), {
    type: 'login.failed',
    userId,
    createdAt: Date.now(),
    ...fingerprints,
  });
};

export const loginWithPassword = async (env: Env, request: Request, input: LoginInput): Promise<LoginResult> => {
  let pepper: string;
  let sessionSecret: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
    sessionSecret = requireSecret(env, 'SESSION_SECRET');
  } catch {
    return { status: 'server-error' };
  }

  const db = getDatabase(env);
  const row = await db
    .prepare(
      `SELECT id, auth_hash, server_salt, kdf_alg, kdf_salt, kdf_iterations,
        vault_key_wrapped, vault_key_wrap_iv, status, session_version
       FROM users WHERE email = ?`,
    )
    .bind(input.email)
    .first<UserRow>();

  const syntheticSalt = encodeBase64((await hmacSha256(pepper, `server:${input.email}`)).slice(0, SALT_BYTES));
  const syntheticHash = encodeBase64((await hmacSha256(pepper, `hash:${input.email}`)).slice(0, KEY_BYTES));
  const serverSalt = row?.server_salt ?? syntheticSalt;
  const expectedHash = row?.auth_hash ?? syntheticHash;

  const verified = await verifyServerAuthHash(input.authHashBytes, serverSalt, pepper, expectedHash);

  if (!row || !verified || row.status !== 'active') {
    await auditFailure(env, request, row?.id ?? null, sessionSecret);
    return { status: 'invalid-credentials' };
  }

  const fingerprints = await fingerprintRequest(request, sessionSecret);

  let body: LoginResponse;
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

  await recordAuditEventSafe(db, {
    type: 'login.succeeded',
    userId: row.id,
    createdAt: Date.now(),
    ...fingerprints,
  });

  return { status: 'ok', cookie: session.cookie, body };
};
