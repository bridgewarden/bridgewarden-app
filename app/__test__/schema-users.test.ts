import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from './fixtures';
import { resetDatabase } from './reset-database';

beforeEach(async () => {
  await resetDatabase();
});

describe('users schema', () => {
  it('starts revision and lockout counters at zero', async () => {
    const userId = await createTestUser();

    const row = await env.DB.prepare(
      'SELECT email, role, status, vault_rev, session_version, failed_login_count, locked_until FROM users WHERE id = ?',
    )
      .bind(userId)
      .first<{
        email: string;
        role: string;
        status: string;
        vault_rev: number;
        session_version: number;
        failed_login_count: number;
        locked_until: number | null;
      }>();

    expect(row).toEqual({
      email: expect.stringContaining('@example.com'),
      role: 'member',
      status: 'active',
      vault_rev: 0,
      session_version: 0,
      failed_login_count: 0,
      locked_until: null,
    });
  });

  it('rejects an email that differs only by case', async () => {
    await createTestUser({ email: 'Case@Example.com' });

    await expect(createTestUser({ email: 'case@example.com' })).rejects.toThrow();
  });

  it('rejects a negative session version', async () => {
    const userId = await createTestUser();

    await expect(
      env.DB.prepare('UPDATE users SET session_version = -1 WHERE id = ?').bind(userId).run(),
    ).rejects.toThrow();
  });

  it('rejects invalid role and status values', async () => {
    const userId = await createTestUser();

    await expect(env.DB.prepare("UPDATE users SET role = 'owner' WHERE id = ?").bind(userId).run()).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE users SET status = 'locked' WHERE id = ?").bind(userId).run(),
    ).rejects.toThrow();
  });

  it('has no plaintext password column', async () => {
    const row = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").first<{
      sql: string;
    }>();

    expect(row?.sql.toLowerCase()).not.toContain('password');
  });
});
