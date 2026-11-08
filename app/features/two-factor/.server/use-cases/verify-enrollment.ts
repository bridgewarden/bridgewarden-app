import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { getDatabase } from '../../../../lib/.server/db';
import { requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { decryptTotpSecret } from '../../../../lib/.server/totp-crypto';
import { verifyCode } from '../../../../lib/.server/totp';
import { generateAndStoreBackupCodes } from '../backup-codes';

export type VerifyEnrollmentResult =
  | { status: 'ok'; backupCodes: string[] }
  | { status: 'invalid-code' }
  | { status: 'not-pending' }
  | { status: 'server-error' };

export const verifyEnrollment = async (
  env: Env,
  request: Request,
  userId: string,
  code: string,
): Promise<VerifyEnrollmentResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const db = getDatabase(env);
  const row = await db
    .prepare('SELECT enabled, totp_secret_ct, totp_secret_iv, last_totp_step FROM user_2fa WHERE user_id = ?')
    .bind(userId)
    .first<{ enabled: number; totp_secret_ct: string; totp_secret_iv: string; last_totp_step: number }>();

  if (!row) return { status: 'not-pending' };
  if (row.enabled === 1) return { status: 'not-pending' };

  let verification;
  try {
    const secret = await decryptTotpSecret(env, userId, {
      ciphertext: row.totp_secret_ct,
      iv: row.totp_secret_iv,
    });
    verification = await verifyCode(secret, code, row.last_totp_step);
  } catch {
    return { status: 'server-error' };
  }
  const fingerprints = await auditFingerprints(env, request);

  if (!verification.valid) {
    await recordAuditEventSafe(db, {
      type: '2fa.enrollment_failed',
      userId,
      createdAt: Date.now(),
      ...fingerprints,
    });
    return { status: 'invalid-code' };
  }

  const update = await db
    .prepare('UPDATE user_2fa SET enabled = 1, last_totp_step = ?, updated_at = ? WHERE user_id = ? AND enabled = 0')
    .bind(verification.step, Date.now(), userId)
    .run();

  if (update.meta.changes !== 1) return { status: 'not-pending' };

  let backupCodes: string[];
  try {
    backupCodes = await generateAndStoreBackupCodes(db, userId, pepper);
  } catch {
    await db
      .prepare('UPDATE user_2fa SET enabled = 0, updated_at = ? WHERE user_id = ?')
      .bind(Date.now(), userId)
      .run();
    return { status: 'server-error' };
  }

  await recordAuditEventSafe(db, {
    type: '2fa.enrolled',
    userId,
    createdAt: Date.now(),
    ...fingerprints,
  });

  return { status: 'ok', backupCodes };
};
