import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { getDatabase } from '../../../../lib/.server/db';
import { requireSecret } from '../../../../lib/.server/env';
import { fingerprintRequest } from '../../../../lib/.server/request-fingerprint';
import { decryptTotpSecret } from '../../../../lib/.server/totp-crypto';
import { verifyCode } from '../../../../lib/.server/totp';
import { completeLogin, type LoginSuccessBody } from '../../../../lib/.server/complete-login';
import { consumeBackupCode } from '../backup-codes';
import {
  consumeChallenge,
  deleteChallenge,
  readChallenge,
  recordChallengeFailure,
} from '../../../../lib/.server/challenge';
import type { ChallengeInput } from '../challenge-input';

type TotpRow = {
  id: string;
  status: 'active' | 'disabled';
  enabled: number;
  totp_secret_ct: string;
  totp_secret_iv: string;
  last_totp_step: number;
};

export type ChallengeResult =
  | { status: 'ok'; body: LoginSuccessBody; cookie: string }
  | { status: 'invalid-code'; challengeInvalid: boolean }
  | { status: 'invalid-challenge' }
  | { status: 'server-error' };

export const verifyChallenge = async (env: Env, request: Request, input: ChallengeInput): Promise<ChallengeResult> => {
  let pepper: string;
  let sessionSecret: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
    sessionSecret = requireSecret(env, 'SESSION_SECRET');
  } catch {
    return { status: 'server-error' };
  }

  const challenge = await readChallenge(env, input.challengeToken);
  if (!challenge) return { status: 'invalid-challenge' };

  const db = getDatabase(env);
  const row = await db
    .prepare(
      `SELECT u.id, u.status, t.enabled, t.totp_secret_ct, t.totp_secret_iv, t.last_totp_step
       FROM users u JOIN user_2fa t ON t.user_id = u.id WHERE u.id = ?`,
    )
    .bind(challenge.record.userId)
    .first<TotpRow>();

  if (!row || row.status !== 'active' || row.enabled !== 1) {
    await deleteChallenge(env, input.challengeToken);
    return { status: 'invalid-challenge' };
  }

  const fingerprints = await fingerprintRequest(request, sessionSecret);
  const fail = async (): Promise<ChallengeResult> => {
    const invalidated = await recordChallengeFailure(env, challenge);
    await recordAuditEventSafe(db, {
      type: '2fa.failed',
      userId: row.id,
      createdAt: Date.now(),
      ...fingerprints,
    });

    return { status: 'invalid-code', challengeInvalid: invalidated };
  };

  if (input.backupCode) {
    const consumed = await consumeBackupCode(db, row.id, input.backupCode, pepper);
    if (!consumed) return fail();
    if (!(await consumeChallenge(env, input.challengeToken))) return fail();
    await recordAuditEventSafe(db, {
      type: '2fa.backup_code_used',
      userId: row.id,
      createdAt: Date.now(),
      ...fingerprints,
    });

    const completed = await completeLogin(env, request, row.id);
    return completed.status === 'ok' ? completed : { status: 'server-error' };
  }

  let step: number;
  try {
    const secret = await decryptTotpSecret(env, row.id, {
      ciphertext: row.totp_secret_ct,
      iv: row.totp_secret_iv,
    });
    const verification = await verifyCode(secret, input.code ?? '', row.last_totp_step);
    if (!verification.valid) return fail();

    step = verification.step;
  } catch {
    return fail();
  }

  const update = await db
    .prepare('UPDATE user_2fa SET last_totp_step = ?, updated_at = ? WHERE user_id = ? AND last_totp_step < ?')
    .bind(step, Date.now(), row.id, step)
    .run();

  if (update.meta.changes !== 1) return fail();
  if (!(await consumeChallenge(env, input.challengeToken))) return fail();
  await recordAuditEventSafe(db, {
    type: '2fa.verified',
    userId: row.id,
    createdAt: Date.now(),
    ...fingerprints,
  });

  const completed = await completeLogin(env, request, row.id);
  return completed.status === 'ok' ? completed : { status: 'server-error' };
};
