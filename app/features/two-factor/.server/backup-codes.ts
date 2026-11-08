import { CROCKFORD_ALPHABET, normalizeCrockford } from '../../../lib/base32';
import { hmacSha256, toHex } from '../../../lib/.server/hmac';

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

export const generateAndStoreBackupCodes = async (
  db: D1Database,
  userId: string,
  pepper: string,
): Promise<string[]> => {
  const codes = generateBackupCodes();
  const now = Date.now();
  const statements = [
    db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(userId),
    ...(await Promise.all(
      codes.map(async (code) =>
        db
          .prepare('INSERT INTO backup_codes (id, user_id, code_hash, used_at, created_at) VALUES (?, ?, ?, NULL, ?)')
          .bind(crypto.randomUUID(), userId, await hashBackupCode(code, pepper), now),
      ),
    )),
  ];

  await db.batch(statements);

  return codes.map(formatBackupCode);
};

export const consumeBackupCode = async (
  db: D1Database,
  userId: string,
  code: string,
  pepper: string,
  now = Date.now(),
): Promise<boolean> => {
  const normalized = normalizeBackupCode(code);
  if (normalized.length !== CODE_LENGTH || !/^[0-9A-HJKMNP-TV-Z]+$/.test(normalized)) return false;

  const result = await db
    .prepare('UPDATE backup_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL')
    .bind(now, userId, await hashBackupCode(normalized, pepper))
    .run();

  return result.meta.changes === 1;
};

export const countRemainingBackupCodes = async (db: D1Database, userId: string): Promise<number> => {
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM backup_codes WHERE user_id = ? AND used_at IS NULL')
    .bind(userId)
    .first<{ count: number }>();

  return row?.count ?? 0;
};
