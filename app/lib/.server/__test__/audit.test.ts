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

    await recordAuditEvent(env.DB, { type: 'bootstrap.created', userId });

    const row = await env.DB.prepare('SELECT user_id, type, metadata FROM audit_events WHERE user_id = ?')
      .bind(userId)
      .first<{ user_id: string; type: string; metadata: string | null }>();

    expect(row).toEqual({ user_id: userId, type: 'bootstrap.created', metadata: null });
  });
});
