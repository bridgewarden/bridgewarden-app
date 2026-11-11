import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { createTwoFactorQueries } from '../queries/two-factor';
import { reissueSessionAfterFactorChange } from '../reissue-session';
import { verifyTwoFactorStepUp } from '../step-up';
import type { StepUpInput } from '../two-factor-input';

export type DisableResult =
  | { status: 'ok'; cookie: string | null }
  | { status: 'invalid-password' }
  | { status: 'locked'; retryAfter: number }
  | { status: 'server-error' };

export const disableTwoFactor = async (
  env: Env,
  request: Request,
  userId: string,
  input: StepUpInput,
): Promise<DisableResult> => {
  const stepUp = await verifyTwoFactorStepUp(env, request, userId, input);
  if (stepUp.status !== 'ok') return stepUp;

  const fingerprints = await auditFingerprints(env, request);
  await createTwoFactorQueries(env).deleteAll(userId);
  await recordAuditEventSafe(env, { type: '2fa.disabled', userId, createdAt: Date.now(), ...fingerprints });
  return { status: 'ok', cookie: await reissueSessionAfterFactorChange(env, request, userId) };
};
