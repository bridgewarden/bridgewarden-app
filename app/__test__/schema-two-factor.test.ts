import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from './fixtures';
import { resetDatabase } from './reset-database';

beforeEach(async () => {
  await resetDatabase();
});

describe('two-factor schema', () => {
  it('keeps one 2FA row per user with a zeroed step', async () => {
    const userId = await createTestUser();
    const now = Date.now();

    await env.DB.prepare(
      'INSERT INTO user_2fa (user_id, totp_secret_ct, totp_secret_iv, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(userId, 'seed-ct', 'seed-iv', now, now)
      .run();

    const row = await env.DB.prepare('SELECT enabled, last_totp_step FROM user_2fa WHERE user_id = ?')
      .bind(userId)
      .first<{ enabled: number; last_totp_step: number }>();

    expect(row).toEqual({ enabled: 0, last_totp_step: 0 });

    await expect(
      env.DB.prepare(
        'INSERT INTO user_2fa (user_id, totp_secret_ct, totp_secret_iv, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(userId, 'other-ct', 'other-iv', now, now)
        .run(),
    ).rejects.toThrow();
  });

  it('rejects an invalid enabled value', async () => {
    const userId = await createTestUser();
    const now = Date.now();

    await env.DB.prepare(
      'INSERT INTO user_2fa (user_id, totp_secret_ct, totp_secret_iv, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(userId, 'seed-ct', 'seed-iv', now, now)
      .run();

    await expect(
      env.DB.prepare('UPDATE user_2fa SET enabled = 2 WHERE user_id = ?').bind(userId).run(),
    ).rejects.toThrow();
  });

  it('stores backup codes as unique hashes with a used marker', async () => {
    const userId = await createTestUser();
    const now = Date.now();

    await env.DB.prepare('INSERT INTO backup_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, 'hash-1', now)
      .run();

    await expect(
      env.DB.prepare('INSERT INTO backup_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)')
        .bind(crypto.randomUUID(), userId, 'hash-1', now)
        .run(),
    ).rejects.toThrow();

    const before = await env.DB.prepare('SELECT used_at FROM backup_codes WHERE code_hash = ?')
      .bind('hash-1')
      .first<{ used_at: number | null }>();
    expect(before?.used_at).toBeNull();

    await env.DB.prepare('UPDATE backup_codes SET used_at = ? WHERE code_hash = ?').bind(now, 'hash-1').run();

    const after = await env.DB.prepare('SELECT used_at FROM backup_codes WHERE code_hash = ?')
      .bind('hash-1')
      .first<{ used_at: number | null }>();
    expect(after?.used_at).toBe(now);
  });
});
