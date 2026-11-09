import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { twoFactorEnv } from './two-factor-fixtures';
import {
  consumeBackupCode,
  countRemainingBackupCodes,
  formatBackupCode,
  generateAndStoreBackupCodes,
  generateBackupCodes,
  hashBackupCode,
  normalizeBackupCode,
} from '../.server/backup-codes';

const PEPPER = 'test-auth-pepper';

beforeEach(async () => {
  await resetDatabase();
});

describe('backup codes', () => {
  it('generates ten unique Crockford codes and normalizes input', () => {
    const codes = generateBackupCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[0-9A-HJKMNP-TV-Z]{10}$/.test(code))).toBe(true);
    expect(formatBackupCode(codes[0])).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
    expect(normalizeBackupCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeBackupCode('IL0O')).toBe('1100');
  });

  it('stores only hashes, consumes once, and counts remaining', async () => {
    const userId = await createTestUser();
    const codes = await generateAndStoreBackupCodes(twoFactorEnv(), userId, PEPPER);
    const raw = codes[0].replace('-', '').toLowerCase();

    const row = await env.DB.prepare('SELECT code_hash, used_at FROM backup_codes WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first<{ code_hash: string; used_at: number | null }>();
    expect(row?.code_hash).toBe(await hashBackupCode(raw, PEPPER));
    expect(row?.code_hash).not.toContain(raw);
    expect(row?.used_at).toBeNull();
    expect(await countRemainingBackupCodes(twoFactorEnv(), userId)).toBe(10);

    await expect(consumeBackupCode(twoFactorEnv(), userId, raw, PEPPER)).resolves.toBe(true);
    await expect(consumeBackupCode(twoFactorEnv(), userId, raw, PEPPER)).resolves.toBe(false);
    expect(await countRemainingBackupCodes(twoFactorEnv(), userId)).toBe(9);
  });

  it('regeneration invalidates every old code', async () => {
    const userId = await createTestUser();
    const first = await generateAndStoreBackupCodes(twoFactorEnv(), userId, PEPPER);
    const second = await generateAndStoreBackupCodes(twoFactorEnv(), userId, PEPPER);

    expect(await countRemainingBackupCodes(twoFactorEnv(), userId)).toBe(10);
    await expect(consumeBackupCode(twoFactorEnv(), userId, first[0], PEPPER)).resolves.toBe(false);
    await expect(consumeBackupCode(twoFactorEnv(), userId, second[0], PEPPER)).resolves.toBe(true);
  });

  it('rejects malformed codes without a database write', async () => {
    const userId = await createTestUser();

    await expect(consumeBackupCode(twoFactorEnv(), userId, 'short', PEPPER)).resolves.toBe(false);
    await expect(consumeBackupCode(twoFactorEnv(), userId, '!!!!!!!!!!', PEPPER)).resolves.toBe(false);
  });
});
