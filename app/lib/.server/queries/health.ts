import { getDatabase } from '../db';

export const checkDatabase = async (env: Env): Promise<boolean> => {
  const row = await getDatabase(env).prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return row?.ok === 1;
};
