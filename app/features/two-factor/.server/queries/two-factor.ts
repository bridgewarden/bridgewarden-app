import { getDatabase } from '../../../../lib/.server/db';
import { PENDING_ENROLLMENT_TTL_MS } from '../constants/enrollment';

export const deleteTwoFactorData = (db: D1Database, userId: string): Promise<D1Result[]> =>
  db.batch([
    db.prepare('DELETE FROM user_2fa WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(userId),
  ]);

export const replaceBackupCodes = (
  db: D1Database,
  userId: string,
  codeHashes: string[],
  now: number,
): Promise<D1Result[]> =>
  db.batch([
    db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(userId),
    ...codeHashes.map((hash) =>
      db
        .prepare('INSERT INTO backup_codes (id, user_id, code_hash, used_at, created_at) VALUES (?, ?, ?, NULL, ?)')
        .bind(crypto.randomUUID(), userId, hash, now),
    ),
  ]);

export const consumeBackupCodeHash = (
  db: D1Database,
  userId: string,
  codeHash: string,
  now: number,
): Promise<D1Result> =>
  db
    .prepare('UPDATE backup_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL')
    .bind(now, userId, codeHash)
    .run();

export const countRemainingBackupCodesForUser = async (db: D1Database, userId: string): Promise<number> => {
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM backup_codes WHERE user_id = ? AND used_at IS NULL')
    .bind(userId)
    .first<{ count: number }>();
  return row?.count ?? 0;
};

export const completeEnrollment = async (
  db: D1Database,
  userId: string,
  step: number,
  now: number,
  codeHashes: string[],
  pendingCutoff = now - PENDING_ENROLLMENT_TTL_MS,
): Promise<boolean> => {
  const pending = `EXISTS (SELECT 1 FROM user_2fa WHERE user_id = ? AND enabled = 0 AND updated_at > ?)`;
  const results = await db.batch([
    db.prepare(`DELETE FROM backup_codes WHERE user_id = ? AND ${pending}`).bind(userId, userId, pendingCutoff),
    ...codeHashes.map((hash) =>
      db
        .prepare(
          `INSERT INTO backup_codes (id, user_id, code_hash, used_at, created_at)
           SELECT ?, ?, ?, NULL, ? WHERE ${pending}`,
        )
        .bind(crypto.randomUUID(), userId, hash, now, userId, pendingCutoff),
    ),
    db
      .prepare(
        'UPDATE user_2fa SET enabled = 1, last_totp_step = ?, updated_at = ? WHERE user_id = ? AND enabled = 0 AND updated_at > ?',
      )
      .bind(step, now, userId, pendingCutoff),
  ]);

  return results.at(-1)?.meta.changes === 1;
};

export const createTwoFactorQueries = (env: Env) => {
  const db = getDatabase(env);
  return {
    deleteAll: (userId: string) => deleteTwoFactorData(db, userId),
    replace: (userId: string, hashes: string[], now: number) => replaceBackupCodes(db, userId, hashes, now),
    consume: (userId: string, hash: string, now: number) => consumeBackupCodeHash(db, userId, hash, now),
    countRemaining: (userId: string) => countRemainingBackupCodesForUser(db, userId),
    completeEnrollment: (userId: string, step: number, now: number, hashes: string[], pendingCutoff?: number) =>
      completeEnrollment(db, userId, step, now, hashes, pendingCutoff),
  };
};
