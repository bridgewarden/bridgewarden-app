import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { recordAuditEvent } from '../audit';

beforeEach(async () => {
  await resetDatabase();
});

describe('audit events', () => {
  it('stores a bootstrap event for a user', async () => {
    const userId = await createTestUser();

    await recordAuditEvent(env.DB, { type: 'bootstrap.created', userId, createdAt: Date.now() });

    const row = await env.DB.prepare('SELECT user_id, type, metadata FROM audit_events WHERE user_id = ?')
      .bind(userId)
      .first<{ user_id: string; type: string; metadata: string | null }>();

    expect(row).toEqual({ user_id: userId, type: 'bootstrap.created', metadata: null });
  });

  it('stores failed events without a user and with fingerprints', async () => {
    await recordAuditEvent(env.DB, {
      type: 'login.failed',
      userId: null,
      createdAt: Date.now(),
      uaHash: 'ua-hash',
      ipHash: 'ip-hash',
    });

    const row = await env.DB.prepare('SELECT user_id, type, ua_hash, ip_hash FROM audit_events').first();
    expect(row).toEqual({ user_id: null, type: 'login.failed', ua_hash: 'ua-hash', ip_hash: 'ip-hash' });
  });
});
