import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import {
  consumeChallenge,
  deleteChallenge,
  readChallenge,
  recordChallengeFailure,
} from '../../../../lib/.server/challenge';
import { completeLogin, type LoginSuccessBody } from '../../../../lib/.server/complete-login';
import { limitIdentity } from '../../../../lib/.server/rate-limit';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { createUserTwoFactorQueries } from '../../../../lib/.server/queries/user-two-factor';
import { decryptTotpSecret } from '../../../../lib/.server/totp-crypto';
import { verifyCode } from '../../../../lib/.server/totp';
import { LOCKOUT_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from '../../../../lib/.server/constants/auth';
import { consumeBackupCode } from '../backup-codes';
import type { ChallengeInput } from '../challenge-input';

export type ChallengeResult =
  | { status: 'ok'; body: LoginSuccessBody; cookie: string }
  | { status: 'invalid-code'; challengeInvalid: boolean }
  | { status: 'invalid-challenge' }
  | { status: 'locked'; retryAfter: number }
  | { status: 'rate-limited'; retryAfter: number }
  | { status: 'server-error' };

export const verifyChallenge = async (env: Env, request: Request, input: ChallengeInput): Promise<ChallengeResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const challenge = await readChallenge(env, input.challengeToken);
  if (!challenge) return { status: 'invalid-challenge' };

  const identityLimit = await limitIdentity(env, '2fa-user', challenge.record.userId);
  if (!identityLimit.allowed) return { status: 'rate-limited', retryAfter: identityLimit.retryAfter };

  const twoFactor = createUserTwoFactorQueries(env);
  const users = createUsersQueries(env);
  const row = await twoFactor.findChallengeUser(challenge.record.userId);

  if (!row || row.status !== 'active' || row.enabled !== 1) {
    await deleteChallenge(env, input.challengeToken);
    return { status: 'invalid-challenge' };
  }

  const now = Date.now();
  if (row.two_factor_locked_until && row.two_factor_locked_until > now) {
    return { status: 'locked', retryAfter: Math.ceil((row.two_factor_locked_until - now) / 1000) };
  }

  const fingerprints = await auditFingerprints(env, request);
  const locked = (until: number | null): ChallengeResult => ({
    status: 'locked',
    retryAfter: Math.max(1, Math.ceil(((until ?? now) - now) / 1000)),
  });
  const failProof = async (forceInvalid = false): Promise<ChallengeResult> => {
    const invalidated = await recordChallengeFailure(env, challenge);
    const state = await users.recordTwoFactorFailure(row.id, now, MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
    await recordAuditEventSafe(env, {
      type: '2fa.failed',
      userId: row.id,
      createdAt: now,
      ...fingerprints,
    });

    if (state && state.failed_count >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await recordAuditEventSafe(env, {
        type: '2fa.locked',
        userId: row.id,
        createdAt: now,
        ...fingerprints,
      });
      return locked(state.locked_until);
    }
    if (!state) {
      const fresh = await twoFactor.findChallengeUser(row.id);
      if (fresh?.two_factor_locked_until && fresh.two_factor_locked_until > now) {
        return locked(fresh.two_factor_locked_until);
      }
    }
    return { status: 'invalid-code', challengeInvalid: forceInvalid || invalidated };
  };
  const challengeLost = (): ChallengeResult => ({ status: 'invalid-code', challengeInvalid: true });

  if (input.backupCode) {
    if (!(await consumeChallenge(env, input.challengeToken))) return challengeLost();
    const consumed = await consumeBackupCode(env, row.id, input.backupCode, pepper);
    if (!consumed) return failProof(true);
    await users.resetTwoFactorFailures(row.id, Date.now());
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
    if (!verification.valid) return failProof();

    step = verification.step;
  } catch {
    return failProof();
  }

  const update = await twoFactor.updateStep(row.id, step, Date.now(), step);

  if (update.meta.changes !== 1) return challengeLost();
  if (!(await consumeChallenge(env, input.challengeToken))) return challengeLost();
  await users.resetTwoFactorFailures(row.id, Date.now());
  await recordAuditEventSafe(env, {
    type: '2fa.verified',
    userId: row.id,
    createdAt: Date.now(),
    ...fingerprints,
  });

  const completed = await completeLogin(env, request, row.id);
  return completed.status === 'ok' ? completed : { status: 'server-error' };
};
