import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { createUserTwoFactorQueries } from '../../../../lib/.server/queries/user-two-factor';
import { decryptTotpSecret } from '../../../../lib/.server/totp-crypto';
import { verifyCode } from '../../../../lib/.server/totp';
import { prepareBackupCodes } from '../backup-codes';
import { reissueSessionAfterFactorChange } from '../reissue-session';
import { createTwoFactorQueries } from '../queries/two-factor';
import { PENDING_ENROLLMENT_TTL_MS } from '../constants/enrollment';

export type VerifyEnrollmentResult =
  | { status: 'ok'; backupCodes: string[]; cookie: string | null }
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

  const twoFactor = createUserTwoFactorQueries(env);
  const row = await twoFactor.findEnrollment(userId);
  const now = Date.now();
  if (!row || row.enabled === 1) return { status: 'not-pending' };
  if (now - row.updated_at > PENDING_ENROLLMENT_TTL_MS) {
    await twoFactor.deletePending(userId, now - PENDING_ENROLLMENT_TTL_MS);
    return { status: 'not-pending' };
  }

  let verification;
  try {
    const secret = await decryptTotpSecret(env, userId, { ciphertext: row.totp_secret_ct, iv: row.totp_secret_iv });
    verification = await verifyCode(secret, code, row.last_totp_step);
  } catch {
    return { status: 'server-error' };
  }
  const fingerprints = await auditFingerprints(env, request);

  if (!verification.valid) {
    await recordAuditEventSafe(env, {
      type: '2fa.enrollment_failed',
      userId,
      createdAt: Date.now(),
      ...fingerprints,
    });
    return { status: 'invalid-code' };
  }

  let backupCodes: string[];
  let hashes: string[];
  try {
    ({ codes: backupCodes, hashes } = await prepareBackupCodes(pepper));
  } catch {
    return { status: 'server-error' };
  }

  try {
    const enabled = await createTwoFactorQueries(env).completeEnrollment(
      userId,
      verification.step,
      Date.now(),
      hashes,
      Date.now() - PENDING_ENROLLMENT_TTL_MS,
    );
    if (!enabled) return { status: 'not-pending' };
  } catch {
    return { status: 'server-error' };
  }

  await recordAuditEventSafe(env, { type: '2fa.enrolled', userId, createdAt: Date.now(), ...fingerprints });
  return { status: 'ok', backupCodes, cookie: await reissueSessionAfterFactorChange(env, request, userId) };
};
