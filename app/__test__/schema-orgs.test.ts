import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestItem, createTestUser } from './fixtures';
import { resetDatabase } from './reset-database';

beforeEach(async () => {
  await resetDatabase();
});

const createOrg = async () => {
  const id = crypto.randomUUID();
  const now = Date.now();

  await env.DB.prepare('INSERT INTO orgs (id, name_ct, name_iv, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, 'org-ct', 'org-iv', now, now)
    .run();

  return id;
};

describe('dormant organization schema', () => {
  it('creates the four tables', async () => {
    const rows = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('orgs', 'org_members', 'collections', 'collection_items')",
    ).all<{ name: string }>();

    expect((rows.results ?? []).map((row) => row.name).sort()).toEqual([
      'collection_items',
      'collections',
      'org_members',
      'orgs',
    ]);
  });

  it('rejects an invalid membership role and a duplicate membership', async () => {
    const userId = await createTestUser();
    const orgId = await createOrg();
    const now = Date.now();

    await expect(
      env.DB.prepare('INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
        .bind(orgId, userId, 'viewer', now)
        .run(),
    ).rejects.toThrow();

    await env.DB.prepare('INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
      .bind(orgId, userId, 'member', now)
      .run();

    await expect(
      env.DB.prepare('INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
        .bind(orgId, userId, 'admin', now)
        .run(),
    ).rejects.toThrow();
  });

  it('links a collection item once', async () => {
    const userId = await createTestUser();
    const itemId = await createTestItem(userId);
    const orgId = await createOrg();
    const collectionId = crypto.randomUUID();
    const now = Date.now();

    await env.DB.prepare(
      'INSERT INTO collections (id, org_id, name_ct, name_iv, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(collectionId, orgId, 'collection-ct', 'collection-iv', now, now)
      .run();

    await env.DB.prepare('INSERT INTO collection_items (collection_id, item_id, created_at) VALUES (?, ?, ?)')
      .bind(collectionId, itemId, now)
      .run();

    await expect(
      env.DB.prepare('INSERT INTO collection_items (collection_id, item_id, created_at) VALUES (?, ?, ?)')
        .bind(collectionId, itemId, now)
        .run(),
    ).rejects.toThrow();
  });
});
