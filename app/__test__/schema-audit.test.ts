import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from './fixtures';
import { resetDatabase } from './reset-database';

beforeEach(async () => {
  await resetDatabase();
});

describe('audit schema', () => {
  it('keeps the event and nulls the user reference after deletion', async () => {
    const userId = await createTestUser();
    const eventId = crypto.randomUUID();

    await env.DB.prepare(
      'INSERT INTO audit_events (id, user_id, type, ip_hash, ua_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(eventId, userId, 'login.failed', 'ip-hash', 'ua-hash', Date.now())
      .run();

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

    const row = await env.DB.prepare('SELECT user_id, type FROM audit_events WHERE id = ?')
      .bind(eventId)
      .first<{ user_id: string | null; type: string }>();

    expect(row).toEqual({ user_id: null, type: 'login.failed' });
  });

  it('has no column intended for credentials or vault content', async () => {
    const row = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'audit_events'",
    ).first<{ sql: string }>();

    const sql = row?.sql.toLowerCase() ?? '';

    expect(sql).not.toContain('password');
    expect(sql).not.toContain('ciphertext');
    expect(sql).not.toContain('data_ct');
  });

  it('creates the user and time index', async () => {
    const row = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_audit_events_user_time'",
    ).first();

    expect(row).toBeTruthy();
  });
});
