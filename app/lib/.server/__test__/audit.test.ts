import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { TEST_PEPPER, testEnv } from '../../../__test__/auth-fixtures';
import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { recordAuditEventSafe } from '../audit';
import { hmacSha256, toHex } from '../hmac';
import { auditFingerprints } from '../request-fingerprint';

const envWithSecrets = testEnv();

beforeEach(async () => {
  await resetDatabase();
});

describe('audit events', () => {
  it('stores a bootstrap event for a user', async () => {
    const userId = await createTestUser();

    await recordAuditEventSafe(envWithSecrets, { type: 'bootstrap.created', userId, createdAt: Date.now() });

    const row = await env.DB.prepare('SELECT user_id, type, metadata FROM audit_events WHERE user_id = ?')
      .bind(userId)
      .first<{ user_id: string; type: string; metadata: string | null }>();

    expect(row).toEqual({ user_id: userId, type: 'bootstrap.created', metadata: null });
  });

  it('preserves caller metadata for attribution', async () => {
    const userId = await createTestUser();
    const metadata = JSON.stringify({ targetUserId: crypto.randomUUID() });

    await recordAuditEventSafe(envWithSecrets, {
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
    await recordAuditEventSafe(envWithSecrets, {
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
      recordAuditEventSafe(envWithSecrets, {
        type: 'admin.role_changed',
        userId,
        createdAt: Date.now(),
        metadata: JSON.stringify({ targetUserId: userId, password: 'secret' }),
      }),
    ).resolves.toBe(true);
    const row = await env.DB.prepare('SELECT metadata FROM audit_events').first<{ metadata: string | null }>();
    expect(row?.metadata).toBeNull();
  });

  it('rejects non-UUID identifier metadata', async () => {
    const userId = await createTestUser();
    await recordAuditEventSafe(envWithSecrets, {
      type: 'admin.role_changed',
      userId,
      createdAt: Date.now(),
      metadata: JSON.stringify({ targetUserId: 'admin@example.com' }),
    });

    const row = await env.DB.prepare('SELECT metadata FROM audit_events WHERE user_id = ?')
      .bind(userId)
      .first<{ metadata: string | null }>();
    expect(row?.metadata).toBeNull();
  });

  it('derives request fingerprints from AUTH_PEPPER', async () => {
    const userId = await createTestUser();
    const request = new Request('https://app.example/login', {
      headers: { 'user-agent': 'test-agent', 'cf-connecting-ip': '203.0.113.7' },
    });
    const fingerprints = await auditFingerprints(envWithSecrets, request);

    await recordAuditEventSafe(envWithSecrets, {
      type: 'login.failed',
      userId,
      createdAt: Date.now(),
      ...fingerprints,
    });

    const row = await env.DB.prepare('SELECT ua_hash, ip_hash FROM audit_events WHERE user_id = ?')
      .bind(userId)
      .first<{ ua_hash: string; ip_hash: string }>();
    expect(row?.ua_hash).toBe(toHex(await hmacSha256(TEST_PEPPER, 'ua:test-agent')));
    expect(row?.ip_hash).toBe(toHex(await hmacSha256(TEST_PEPPER, 'ip:203.0.113.7')));
  });

  it('stores failed events without a user and with fingerprints', async () => {
    await recordAuditEventSafe(envWithSecrets, {
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
