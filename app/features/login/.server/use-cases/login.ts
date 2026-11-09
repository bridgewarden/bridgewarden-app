import { KEY_BYTES, SALT_BYTES } from '../../../../lib/crypto/contract';
import { encodeBase64 } from '../../../../lib/crypto/encoding';
import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { hmacSha256 } from '../../../../lib/.server/hmac';
import { fingerprintRequest } from '../../../../lib/.server/request-fingerprint';
import { verifyServerAuthHash } from '../../../../lib/.server/verify-auth';
import { createChallenge } from '../../../../lib/.server/challenge';
import { completeLogin, type LoginSuccessBody } from '../../../../lib/.server/complete-login';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import type { LoginInput } from '../login-input';

export type LoginResult =
  | { status: 'ok'; body: LoginSuccessBody; cookie: string }
  | { status: 'challenge'; challengeToken: string }
  | { status: 'invalid-credentials' }
  | { status: 'server-error' };

const auditFailure = async (env: Env, request: Request, userId: string | null, secret: string): Promise<void> => {
  const fingerprints = await fingerprintRequest(request, secret);

  await recordAuditEventSafe(env, {
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

  const row = await createUsersQueries(env).findLoginByEmail(input.email);

  const syntheticSalt = encodeBase64((await hmacSha256(pepper, `server:${input.email}`)).slice(0, SALT_BYTES));
  const syntheticHash = encodeBase64((await hmacSha256(pepper, `hash:${input.email}`)).slice(0, KEY_BYTES));
  const serverSalt = row?.server_salt ?? syntheticSalt;
  const expectedHash = row?.auth_hash ?? syntheticHash;

  const verified = await verifyServerAuthHash(input.authHashBytes, serverSalt, pepper, expectedHash);

  if (!row || !verified || row.status !== 'active') {
    await auditFailure(env, request, row?.id ?? null, sessionSecret);
    return { status: 'invalid-credentials' };
  }

  if (row.two_factor_enabled === 1) {
    const challengeToken = await createChallenge(env, row.id);
    const fingerprints = await fingerprintRequest(request, sessionSecret);
    await recordAuditEventSafe(env, {
      type: '2fa.challenge_issued',
      userId: row.id,
      createdAt: Date.now(),
      ...fingerprints,
    });

    return { status: 'challenge', challengeToken };
  }

  return completeLogin(env, request, row.id);
};
