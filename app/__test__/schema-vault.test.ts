import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestFolder, createTestItem, createTestUser } from './fixtures';
import { resetDatabase } from './reset-database';

beforeEach(async () => {
  await resetDatabase();
});

describe('vault schema', () => {
  it('stores an item with a folder reference', async () => {
    const userId = await createTestUser();
    const folderId = await createTestFolder(userId);
    const itemId = await createTestItem(userId, { folderId });

    const row = await env.DB.prepare('SELECT folder_id, type, rev FROM vault_items WHERE id = ?')
      .bind(itemId)
      .first<{ folder_id: string; type: string; rev: number }>();

    expect(row).toEqual({ folder_id: folderId, type: 'login', rev: 1 });
  });

  it('rejects an unknown item type', async () => {
    const userId = await createTestUser();
    const itemId = await createTestItem(userId);

    await expect(
      env.DB.prepare("UPDATE vault_items SET type = 'card' WHERE id = ?").bind(itemId).run(),
    ).rejects.toThrow();
  });

  it('increments the revision and records a tombstone', async () => {
    const userId = await createTestUser();
    const itemId = await createTestItem(userId);

    await env.DB.prepare('UPDATE vault_items SET rev = 2, deleted_at = ? WHERE id = ?').bind(Date.now(), itemId).run();

    const row = await env.DB.prepare('SELECT rev, deleted_at FROM vault_items WHERE id = ?')
      .bind(itemId)
      .first<{ rev: number; deleted_at: number | null }>();

    expect(row?.rev).toBe(2);
    expect(row?.deleted_at).toBeTypeOf('number');
  });

  it('detaches items when their folder is deleted', async () => {
    const userId = await createTestUser();
    const folderId = await createTestFolder(userId);
    const itemId = await createTestItem(userId, { folderId });

    await env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(folderId).run();

    const row = await env.DB.prepare('SELECT folder_id FROM vault_items WHERE id = ?')
      .bind(itemId)
      .first<{ folder_id: string | null }>();

    expect(row?.folder_id).toBeNull();
  });

  it('rejects an item whose user does not exist', async () => {
    await expect(createTestItem(crypto.randomUUID())).rejects.toThrow();
  });

  it('stores no plaintext vault columns', async () => {
    const rows = await env.DB.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN ('vault_items', 'folders')",
    ).all<{ name: string; sql: string }>();

    const vault = rows.results?.find((row) => row.name === 'vault_items')?.sql.toLowerCase() ?? '';
    const folders = rows.results?.find((row) => row.name === 'folders')?.sql.toLowerCase() ?? '';

    expect(vault).not.toContain('password');
    expect(vault).not.toContain('username');
    expect(vault).not.toContain('notes');
    expect(folders).not.toContain('name text');
  });

  it('creates the required indexes', async () => {
    const rows = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'").all<{
      name: string;
    }>();

    const names = (rows.results ?? []).map((row) => row.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'idx_folders_user',
        'idx_vault_items_user_rev',
        'idx_vault_items_user_deleted',
        'idx_vault_items_user_folder',
        'idx_vault_items_user_type',
      ]),
    );
  });
});
