import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { getDatabase } from '../../../../lib/.server/db';
import { readConfig, requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
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

  const db = getDatabase(env);
  const user = await db
    .prepare('SELECT auth_hash, server_salt, status FROM users WHERE id = ?')
    .bind(userId)
    .first<{ auth_hash: string; server_salt: string; status: 'active' | 'disabled' }>();

  if (!user || user.status !== 'active') return { status: 'server-error' };
  if (!(await verifyServerAuthHash(input.authHashBytes, user.server_salt, pepper, user.auth_hash))) {
    return { status: 'invalid-password' };
  }

  const existing = await db
    .prepare('SELECT enabled FROM user_2fa WHERE user_id = ?')
    .bind(userId)
    .first<{ enabled: number }>();

  if (existing?.enabled === 1) return { status: 'already-enabled' };

  const secret = generateSecret();
  let encrypted;
  try {
    encrypted = await encryptTotpSecret(env, userId, secret);
  } catch {
    return { status: 'server-error' };
  }

  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO user_2fa (user_id, totp_secret_ct, totp_secret_iv, enabled, last_totp_step, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         totp_secret_ct = excluded.totp_secret_ct,
         totp_secret_iv = excluded.totp_secret_iv,
         enabled = 0,
         last_totp_step = 0,
         updated_at = excluded.updated_at
       WHERE user_2fa.enabled = 0`,
    )
    .bind(userId, encrypted.ciphertext, encrypted.iv, now, now)
    .run();

  const check = await db
    .prepare('SELECT enabled FROM user_2fa WHERE user_id = ?')
    .bind(userId)
    .first<{ enabled: number }>();
  if (check?.enabled === 1) return { status: 'already-enabled' };

  const secretText = encodeBase32(secret);
  const issuer = readConfig(env, 'TOTP_ISSUER') ?? 'Bridgewarden';
  const uri = buildOtpauthUri(secret, email, issuer);
  const fingerprints = await auditFingerprints(env, request);

  await recordAuditEventSafe(db, {
    type: '2fa.enrollment_started',
    userId,
    createdAt: now,
    ...fingerprints,
  });

  return { status: 'ok', secret: secretText, uri };
};
