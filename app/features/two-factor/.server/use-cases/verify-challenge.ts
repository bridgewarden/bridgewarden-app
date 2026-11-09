import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { fingerprintRequest } from '../../../../lib/.server/request-fingerprint';
import {
  consumeChallenge,
  deleteChallenge,
  readChallenge,
  recordChallengeFailure,
} from '../../../../lib/.server/challenge';
import { completeLogin, type LoginSuccessBody } from '../../../../lib/.server/complete-login';
import { createUserTwoFactorQueries } from '../../../../lib/.server/queries/user-two-factor';
import { decryptTotpSecret } from '../../../../lib/.server/totp-crypto';
import { verifyCode } from '../../../../lib/.server/totp';
import { consumeBackupCode } from '../backup-codes';
import type { ChallengeInput } from '../challenge-input';

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

  const twoFactor = createUserTwoFactorQueries(env);
  const row = await twoFactor.findChallengeUser(challenge.record.userId);

  if (!row || row.status !== 'active' || row.enabled !== 1) {
    await deleteChallenge(env, input.challengeToken);
    return { status: 'invalid-challenge' };
  }

  const fingerprints = await fingerprintRequest(request, sessionSecret);
  const fail = async (): Promise<ChallengeResult> => {
    const invalidated = await recordChallengeFailure(env, challenge);
    await recordAuditEventSafe(env, {
      type: '2fa.failed',
      userId: row.id,
      createdAt: Date.now(),
      ...fingerprints,
    });

    return { status: 'invalid-code', challengeInvalid: invalidated };
  };

  if (input.backupCode) {
    const consumed = await consumeBackupCode(env, row.id, input.backupCode, pepper);
    if (!consumed) return fail();
    if (!(await consumeChallenge(env, input.challengeToken))) return fail();
    await recordAuditEventSafe(env, {
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

  const update = await twoFactor.updateStep(row.id, step, Date.now(), step);

  if (update.meta.changes !== 1) return fail();
  if (!(await consumeChallenge(env, input.challengeToken))) return fail();
  await recordAuditEventSafe(env, {
    type: '2fa.verified',
    userId: row.id,
    createdAt: Date.now(),
    ...fingerprints,
  });

  const completed = await completeLogin(env, request, row.id);
  return completed.status === 'ok' ? completed : { status: 'server-error' };
};
