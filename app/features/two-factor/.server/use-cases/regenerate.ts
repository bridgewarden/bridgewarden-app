import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { createUserTwoFactorQueries } from '../../../../lib/.server/queries/user-two-factor';
import { generateAndStoreBackupCodes } from '../backup-codes';
import { reissueSessionAfterFactorChange } from '../reissue-session';
import { verifyTwoFactorStepUp } from '../step-up';
import type { StepUpInput } from '../two-factor-input';

export type RegenerateResult =
  | { status: 'ok'; backupCodes: string[]; cookie: string | null }
  | { status: 'not-enabled' }
  | { status: 'invalid-password' }
  | { status: 'locked'; retryAfter: number }
  | { status: 'server-error' };

export const regenerateBackupCodes = async (
  env: Env,
  request: Request,
  userId: string,
  input: StepUpInput,
): Promise<RegenerateResult> => {
  const stepUp = await verifyTwoFactorStepUp(env, request, userId, input);
  if (stepUp.status !== 'ok') return stepUp;
  const pepper = stepUp.pepper;

  if (!(await createUserTwoFactorQueries(env).isEnabled(userId))) return { status: 'not-enabled' };

  const backupCodes = await generateAndStoreBackupCodes(env, userId, pepper);
  const fingerprints = await auditFingerprints(env, request);

  await recordAuditEventSafe(env, {
    type: '2fa.backup_codes_regenerated',
    userId,
    createdAt: Date.now(),
    ...fingerprints,
  });

  return { status: 'ok', backupCodes, cookie: await reissueSessionAfterFactorChange(env, request, userId) };
};
