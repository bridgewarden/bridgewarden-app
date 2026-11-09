import { createUserTwoFactorQueries } from '../../../../lib/.server/queries/user-two-factor';
import { countRemainingBackupCodes } from '../backup-codes';

export type TwoFactorSummary = { enabled: boolean; remaining: number };

export const getTwoFactorSummary = async (env: Env, userId: string): Promise<TwoFactorSummary> => {
  const enabled = await createUserTwoFactorQueries(env).isEnabled(userId);
  return { enabled, remaining: enabled ? await countRemainingBackupCodes(env, userId) : 0 };
};
