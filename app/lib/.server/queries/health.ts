import { getDatabase } from '../db';

export const checkDatabase = async (env: Env): Promise<boolean> => {
  const row = await getDatabase(env).prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return row?.ok === 1;
};

export const readAppliedSchemaVersion = async (env: Env): Promise<number | null> => {
  const row = await getDatabase(env)
    .prepare('SELECT MAX(CAST(substr(name, 1, 4) AS INTEGER)) AS version FROM d1_migrations')
    .first<{ version: number | null }>();
  return row?.version ?? null;
};
