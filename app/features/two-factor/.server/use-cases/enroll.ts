import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { readConfig, requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { createUserTwoFactorQueries } from '../../../../lib/.server/queries/user-two-factor';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { encryptTotpSecret } from '../../../../lib/.server/totp-crypto';
import { buildOtpauthUri, encodeBase32, generateSecret } from '../../../../lib/.server/totp';
import { verifyServerAuthHash } from '../../../../lib/.server/verify-auth';
import type { DisableInput } from '../two-factor-input';

export type EnrollResult =
  | { status: 'ok'; secret: string; uri: string }
  | { status: 'already-enabled' }
  | { status: 'invalid-password' }
  | { status: 'server-error' };

export const beginEnrollment = async (
  env: Env,
  request: Request,
  userId: string,
  email: string,
  input: DisableInput,
): Promise<EnrollResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const user = await createUsersQueries(env).findAuthById(userId);
  if (!user || user.status !== 'active') return { status: 'server-error' };
  if (!(await verifyServerAuthHash(input.authHashBytes, user.server_salt, pepper, user.auth_hash))) {
    return { status: 'invalid-password' };
  }

  const twoFactor = createUserTwoFactorQueries(env);
  if (await twoFactor.isEnabled(userId)) return { status: 'already-enabled' };

  const secret = generateSecret();
  let encrypted;
  try {
    encrypted = await encryptTotpSecret(env, userId, secret);
  } catch {
    return { status: 'server-error' };
  }

  const now = Date.now();
  const upsert = await twoFactor.upsertPending(userId, encrypted.ciphertext, encrypted.iv, now);
  if (upsert.meta.changes !== 1) return { status: 'already-enabled' };

  const secretText = encodeBase32(secret);
  const issuer = readConfig(env, 'TOTP_ISSUER') ?? 'Bridgewarden';
  const uri = buildOtpauthUri(secret, email, issuer);
  const fingerprints = await auditFingerprints(env, request);

  await recordAuditEventSafe(env, { type: '2fa.enrollment_started', userId, createdAt: now, ...fingerprints });
  return { status: 'ok', secret: secretText, uri };
};
