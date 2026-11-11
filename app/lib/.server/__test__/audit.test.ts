import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { recordAuditEventSafe } from '../audit';

const testEnv = env as unknown as Env;

beforeEach(async () => {
  await resetDatabase();
});

describe('audit events', () => {
  it('stores a bootstrap event for a user', async () => {
    const userId = await createTestUser();

    await recordAuditEventSafe(testEnv, { type: 'bootstrap.created', userId, createdAt: Date.now() });

    const row = await env.DB.prepare('SELECT user_id, type, metadata FROM audit_events WHERE user_id = ?')
      .bind(userId)
      .first<{ user_id: string; type: string; metadata: string | null }>();

    expect(row).toEqual({ user_id: userId, type: 'bootstrap.created', metadata: null });
  });

  it('preserves caller metadata for attribution', async () => {
    const userId = await createTestUser();
    const metadata = JSON.stringify({ targetUserId: crypto.randomUUID() });

    await recordAuditEventSafe(testEnv, {
      type: 'admin.role_changed',
      userId,
      createdAt: Date.now(),
      metadata,
    });

    const row = await env.DB.prepare('SELECT metadata FROM audit_events WHERE user_id = ?')
      .bind(userId)
      .first<{ metadata: string | null }>();
    expect(row?.metadata).toBe(metadata);
  });

  it('preserves invitation metadata', async () => {
    const userId = await createTestUser();
    const invitationId = crypto.randomUUID();
    await recordAuditEventSafe(testEnv, {
      type: 'admin.invitation_created',
      userId,
      createdAt: Date.now(),
      metadata: JSON.stringify({ invitationId }),
    });
    const row = await env.DB.prepare('SELECT metadata FROM audit_events WHERE type = ?')
      .bind('admin.invitation_created')
      .first<{ metadata: string | null }>();
    expect(row?.metadata).toBe(JSON.stringify({ invitationId }));
  });

  it('rejects credential-shaped metadata', async () => {
    const userId = await createTestUser();
    await expect(
      recordAuditEventSafe(testEnv, {
        type: 'admin.role_changed',
        userId,
        createdAt: Date.now(),
        metadata: JSON.stringify({ targetUserId: userId, password: 'secret' }),
      }),
    ).resolves.toBe(true);
    const row = await env.DB.prepare('SELECT metadata FROM audit_events').first<{ metadata: string | null }>();
    expect(row?.metadata).toBeNull();
  });

  it('stores failed events without a user and with fingerprints', async () => {
    await recordAuditEventSafe(testEnv, {
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
