import { getDatabase } from '../db';

export type ChallengeRow = {
  user_id: string;
  expires_at: number;
  attempts: number;
};

export const deleteExpiredChallenges = (db: D1Database, now: number): Promise<D1Result> =>
  db.prepare('DELETE FROM two_factor_challenges WHERE expires_at < ?').bind(now).run();

export const insertChallenge = (
  db: D1Database,
  tokenHash: string,
  userId: string,
  expiresAt: number,
): Promise<D1Result> =>
  db
    .prepare(
      'INSERT INTO two_factor_challenges (token_hash, user_id, expires_at, attempts, consumed_at) VALUES (?, ?, ?, 0, NULL)',
    )
    .bind(tokenHash, userId, expiresAt)
    .run();

export const replaceChallenge = (
  db: D1Database,
  tokenHash: string,
  userId: string,
  expiresAt: number,
  now: number,
): Promise<D1Result[]> =>
  db.batch([
    db.prepare('DELETE FROM two_factor_challenges WHERE expires_at < ?').bind(now),
    db
      .prepare(
        'INSERT INTO two_factor_challenges (token_hash, user_id, expires_at, attempts, consumed_at) VALUES (?, ?, ?, 0, NULL)',
      )
      .bind(tokenHash, userId, expiresAt),
  ]);

export const findChallenge = (db: D1Database, tokenHash: string): Promise<ChallengeRow | null> =>
  db
    .prepare(
      'SELECT user_id, expires_at, attempts FROM two_factor_challenges WHERE token_hash = ? AND consumed_at IS NULL',
    )
    .bind(tokenHash)
    .first<ChallengeRow>();

export const incrementChallengeFailure = (
  db: D1Database,
  tokenHash: string,
  now: number,
  maxAttempts: number,
): Promise<D1Result> =>
  db
    .prepare(
      `UPDATE two_factor_challenges SET attempts = attempts + 1
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < ?`,
    )
    .bind(tokenHash, now, maxAttempts)
    .run();

export const findChallengeAttempts = (
  db: D1Database,
  tokenHash: string,
): Promise<{ attempts: number; consumed_at: number | null } | null> =>
  db
    .prepare('SELECT attempts, consumed_at FROM two_factor_challenges WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ attempts: number; consumed_at: number | null }>();

export const consumeChallengeRow = (
  db: D1Database,
  tokenHash: string,
  now: number,
  maxAttempts: number,
): Promise<D1Result> =>
  db
    .prepare(
      `UPDATE two_factor_challenges SET consumed_at = ?
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < ?`,
    )
    .bind(now, tokenHash, now, maxAttempts)
    .run();

export const deleteChallengeRow = (db: D1Database, tokenHash: string): Promise<D1Result> =>
  db.prepare('DELETE FROM two_factor_challenges WHERE token_hash = ?').bind(tokenHash).run();

export const createChallengeQueries = (env: Env) => {
  const db = getDatabase(env);
  return {
    deleteExpired: (now: number) => deleteExpiredChallenges(db, now),
    insert: (tokenHash: string, userId: string, expiresAt: number) => insertChallenge(db, tokenHash, userId, expiresAt),
    replace: (tokenHash: string, userId: string, expiresAt: number, now: number) =>
      replaceChallenge(db, tokenHash, userId, expiresAt, now),
    find: (tokenHash: string) => findChallenge(db, tokenHash),
    incrementFailure: (tokenHash: string, now: number, max: number) =>
      incrementChallengeFailure(db, tokenHash, now, max),
    findAttempts: (tokenHash: string) => findChallengeAttempts(db, tokenHash),
    consume: (tokenHash: string, now: number, max: number) => consumeChallengeRow(db, tokenHash, now, max),
    delete: (tokenHash: string) => deleteChallengeRow(db, tokenHash),
  };
};
