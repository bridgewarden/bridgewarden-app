import { recordAuditEventSafe } from '../../../lib/.server/audit';
import { requireSecret } from '../../../lib/.server/env';
import { verifyPasswordProof } from '../../../lib/.server/password-proof';
import { auditFingerprints } from '../../../lib/.server/request-fingerprint';
import { createUsersQueries } from '../../../lib/.server/queries/users';
import { LOCKOUT_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from '../../../lib/.server/constants/auth';
import type { StepUpInput } from './two-factor-input';

export type StepUpResult =
  | { status: 'ok'; pepper: string }
  | { status: 'invalid-password' }
  | { status: 'locked'; retryAfter: number }
  | { status: 'server-error' };

export const verifyTwoFactorStepUp = async (
  env: Env,
  request: Request,
  userId: string,
  input: StepUpInput,
): Promise<StepUpResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const users = createUsersQueries(env);
  const state = await users.findStepUpState(userId);
  if (!state || state.status !== 'active') return { status: 'server-error' };

  const now = Date.now();
  const result = await verifyPasswordProof({
    authHashBytes: input.authHashBytes,
    serverSalt: state.server_salt,
    pepper,
    expectedHash: state.auth_hash,
    lockedUntil: state.step_up_locked_until,
    now,
    maxAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
    durationMs: LOCKOUT_DURATION_MS,
    reserveAttempt: () => users.reserveStepUpAttempt(userId, now, MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS),
    recordFailure: async () => {
      const current = await users.findStepUpState(userId);
      return current
        ? { failed_count: current.step_up_failed_count, locked_until: current.step_up_locked_until }
        : null;
    },
    resetFailures: () => users.resetStepUpFailures(userId, Date.now()),
    onFailure: async () => {
      await recordAuditEventSafe(env, {
        type: '2fa.step_up_failed',
        userId,
        createdAt: now,
        ...(await auditFingerprints(env, request)),
      });
    },
  });

  return result.status === 'ok' ? { status: 'ok', pepper } : result;
};
