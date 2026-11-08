import { countRemainingBackupCodes } from '../backup-codes';
import { getDatabase } from '../../../../lib/.server/db';

export type TwoFactorSummary = {
  enabled: boolean;
  remaining: number;
};

export const getTwoFactorSummary = async (env: Env, userId: string): Promise<TwoFactorSummary> => {
  const db = getDatabase(env);
  const row = await db
    .prepare('SELECT enabled FROM user_2fa WHERE user_id = ?')
    .bind(userId)
    .first<{ enabled: number }>();
  const enabled = row?.enabled === 1;

  return { enabled, remaining: enabled ? await countRemainingBackupCodes(db, userId) : 0 };
};
