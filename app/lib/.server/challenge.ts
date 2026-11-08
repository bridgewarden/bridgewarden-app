import { toBase64Url } from '../base64-url';
import { getDatabase } from './db';
import { hashSessionToken } from './session';

export const CHALLENGE_TTL_SECONDS = 300;
export const MAX_CHALLENGE_ATTEMPTS = 5;
export const CHALLENGE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type ChallengeRecord = {
  userId: string;
  expiresAt: number;
  attempts: number;
};

export type StoredChallenge = {
  token: string;
  record: ChallengeRecord;
};

export const createChallenge = async (env: Env, userId: string): Promise<string> => {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const db = getDatabase(env);
  const now = Date.now();

  await db.prepare('DELETE FROM two_factor_challenges WHERE expires_at < ?').bind(now).run();
  await db
    .prepare(
      'INSERT INTO two_factor_challenges (token_hash, user_id, expires_at, attempts, consumed_at) VALUES (?, ?, ?, 0, NULL)',
    )
    .bind(await hashSessionToken(token), userId, now + CHALLENGE_TTL_SECONDS * 1000)
    .run();

  return token;
};

export const readChallenge = async (env: Env, token: string): Promise<StoredChallenge | null> => {
  if (!CHALLENGE_TOKEN_PATTERN.test(token)) return null;

  const row = await getDatabase(env)
    .prepare(
      'SELECT user_id, expires_at, attempts FROM two_factor_challenges WHERE token_hash = ? AND consumed_at IS NULL',
    )
    .bind(await hashSessionToken(token))
    .first<{ user_id: string; expires_at: number; attempts: number }>();

  if (!row || row.expires_at <= Date.now() || row.attempts >= MAX_CHALLENGE_ATTEMPTS) return null;

  return {
    token,
    record: { userId: row.user_id, expiresAt: row.expires_at, attempts: row.attempts },
  };
};

export const recordChallengeFailure = async (env: Env, challenge: StoredChallenge): Promise<boolean> => {
  const db = getDatabase(env);
  const now = Date.now();
  const result = await db
    .prepare(
      `UPDATE two_factor_challenges
       SET attempts = attempts + 1
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < ?`,
    )
    .bind(await hashSessionToken(challenge.token), now, MAX_CHALLENGE_ATTEMPTS)
    .run();

  if (result.meta.changes !== 1) return true;

  const row = await db
    .prepare('SELECT attempts, consumed_at FROM two_factor_challenges WHERE token_hash = ?')
    .bind(await hashSessionToken(challenge.token))
    .first<{ attempts: number; consumed_at: number | null }>();

  return row?.consumed_at !== null || (row?.attempts ?? MAX_CHALLENGE_ATTEMPTS) >= MAX_CHALLENGE_ATTEMPTS;
};

export const consumeChallenge = async (env: Env, token: string): Promise<boolean> => {
  const now = Date.now();
  const result = await getDatabase(env)
    .prepare(
      `UPDATE two_factor_challenges
       SET consumed_at = ?
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < ?`,
    )
    .bind(now, await hashSessionToken(token), now, MAX_CHALLENGE_ATTEMPTS)
    .run();

  return result.meta.changes === 1;
};

export const deleteChallenge = async (env: Env, token: string): Promise<void> => {
  await getDatabase(env)
    .prepare('DELETE FROM two_factor_challenges WHERE token_hash = ?')
    .bind(await hashSessionToken(token))
    .run();
};
