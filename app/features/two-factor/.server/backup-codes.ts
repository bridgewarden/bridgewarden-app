import { CROCKFORD_ALPHABET, normalizeCrockford } from '../../../lib/base32';
import { hmacSha256, toHex } from '../../../lib/.server/hmac';
import { createTwoFactorQueries } from './queries/two-factor';

const CODE_LENGTH = 10;
const CODE_COUNT = 10;

export const normalizeBackupCode = normalizeCrockford;

const randomCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((byte) => CROCKFORD_ALPHABET[byte % CROCKFORD_ALPHABET.length]).join('');
};

export const generateBackupCodes = (): string[] => Array.from({ length: CODE_COUNT }, randomCode);
export const formatBackupCode = (code: string): string => `${code.slice(0, 5)}-${code.slice(5)}`;
export const hashBackupCode = async (code: string, pepper: string): Promise<string> =>
  toHex(await hmacSha256(pepper, `backup:${normalizeBackupCode(code)}`));

export const prepareBackupCodes = async (pepper: string): Promise<{ codes: string[]; hashes: string[] }> => {
  const codes = generateBackupCodes();
  const hashes = await Promise.all(codes.map((code) => hashBackupCode(code, pepper)));
  return { codes: codes.map(formatBackupCode), hashes };
};

export const generateAndStoreBackupCodes = async (env: Env, userId: string, pepper: string): Promise<string[]> => {
  const { codes, hashes } = await prepareBackupCodes(pepper);
  await createTwoFactorQueries(env).replace(userId, hashes, Date.now());
  return codes;
};

export const consumeBackupCode = async (
  env: Env,
  userId: string,
  code: string,
  pepper: string,
  now = Date.now(),
): Promise<boolean> => {
  const normalized = normalizeBackupCode(code);
  if (normalized.length !== CODE_LENGTH || !/^[0-9A-HJKMNP-TV-Z]+$/.test(normalized)) return false;

  const result = await createTwoFactorQueries(env).consume(userId, await hashBackupCode(normalized, pepper), now);
  return result.meta.changes === 1;
};

export const countRemainingBackupCodes = (env: Env, userId: string): Promise<number> =>
  createTwoFactorQueries(env).countRemaining(userId);
