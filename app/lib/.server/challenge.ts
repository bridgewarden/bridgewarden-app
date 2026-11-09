import { toBase64Url } from '../base64-url';
import { createChallengeQueries } from './queries/two-factor-challenges';
import { hashSessionToken } from './session';

export const CHALLENGE_TTL_SECONDS = 300;
export const MAX_CHALLENGE_ATTEMPTS = 5;
export const CHALLENGE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type ChallengeRecord = { userId: string; expiresAt: number; attempts: number };
export type StoredChallenge = { token: string; record: ChallengeRecord };

export const createChallenge = async (env: Env, userId: string): Promise<string> => {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const queries = createChallengeQueries(env);
  const now = Date.now();

  await queries.replace(await hashSessionToken(token), userId, now + CHALLENGE_TTL_SECONDS * 1000, now);

  return token;
};

export const readChallenge = async (env: Env, token: string): Promise<StoredChallenge | null> => {
  if (!CHALLENGE_TOKEN_PATTERN.test(token)) return null;

  const row = await createChallengeQueries(env).find(await hashSessionToken(token));
  if (!row || row.expires_at <= Date.now() || row.attempts >= MAX_CHALLENGE_ATTEMPTS) return null;

  return { token, record: { userId: row.user_id, expiresAt: row.expires_at, attempts: row.attempts } };
};

export const recordChallengeFailure = async (env: Env, challenge: StoredChallenge): Promise<boolean> => {
  const queries = createChallengeQueries(env);
  const tokenHash = await hashSessionToken(challenge.token);
  const now = Date.now();
  const result = await queries.incrementFailure(tokenHash, now, MAX_CHALLENGE_ATTEMPTS);

  if (result.meta.changes !== 1) return true;

  const row = await queries.findAttempts(tokenHash);
  return row?.consumed_at !== null || (row?.attempts ?? MAX_CHALLENGE_ATTEMPTS) >= MAX_CHALLENGE_ATTEMPTS;
};

export const consumeChallenge = async (env: Env, token: string): Promise<boolean> => {
  const now = Date.now();
  const result = await createChallengeQueries(env).consume(await hashSessionToken(token), now, MAX_CHALLENGE_ATTEMPTS);
  return result.meta.changes === 1;
};

export const deleteChallenge = async (env: Env, token: string): Promise<void> => {
  await createChallengeQueries(env).delete(await hashSessionToken(token));
};
