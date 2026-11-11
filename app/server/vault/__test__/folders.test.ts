import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { testEnv } from '../../../__test__/auth-fixtures';
import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { encodeBase64 } from '../../../lib/crypto/encoding';
import { createFolder, deleteFolder, listFolders, renameFolder } from '../folders';
import { createVaultQueries } from '../queries';
import { createVaultItem, updateVaultItem } from '../items';
import { findOwnedItem } from '../queries/items';
import { findAnyOwnedFolder } from '../queries/folders';
import { findVaultRev } from '../queries/rev';
import { readVaultDelta } from '../sync';
import type { VaultFolderInput, VaultItemInput } from '../types';

const folderInput = (): VaultFolderInput => ({
  nameCt: encodeBase64(new Uint8Array([1, 2, 3])),
  nameIv: encodeBase64(new Uint8Array(12).fill(4)),
  dataVersion: 1,
});

const itemInput = (folderId: string | null): VaultItemInput => ({
  type: 'login',
  folderId,
  favorite: false,
  dataCt: encodeBase64(new Uint8Array([5, 6])),
  dataIv: encodeBase64(new Uint8Array(12).fill(7)),
  dataVersion: 1,
});

const makeFolder = async (userId: string) => {
  const result = await createFolder(testEnv(), userId, folderInput());
  if (result.status !== 'created') throw new Error('folder create failed');
  return result.folder;
};

beforeEach(async () => {
  await resetDatabase();
});

describe('folder use cases', () => {
  it('creates, lists, renames, and hides tombstones', async () => {
    const userId = await createTestUser();
    const folder = await makeFolder(userId);
    expect(folder.rev).toBe(1);
    expect(folder.deletedAt).toBeNull();

    const listed = await listFolders(testEnv(), userId);
    expect(listed.status).toBe('ok');
    if (listed.status === 'ok') expect(listed.folders).toHaveLength(1);

    const renamed = await renameFolder(testEnv(), userId, folder.id, {
      ...folderInput(),
      dataVersion: 2,
      rev: folder.rev,
    });
    expect(renamed.status).toBe('ok');
    if (renamed.status !== 'ok') throw new Error('rename failed');
    expect(renamed.folder.rev).toBe(2);
    expect(renamed.folder.dataVersion).toBe(2);

    const stale = await renameFolder(testEnv(), userId, folder.id, { ...folderInput(), rev: folder.rev });
    expect(stale.status).toBe('conflict');
    if (stale.status === 'conflict') expect(stale.folder.rev).toBe(2);

    const deleted = await deleteFolder(testEnv(), userId, folder.id);
    expect(deleted.status).toBe('ok');
    const hidden = await listFolders(testEnv(), userId);
    if (hidden.status === 'ok') expect(hidden.folders).toHaveLength(0);
  });

  it('detaches items with the folder tombstone revision and syncs both', async () => {
    const userId = await createTestUser();
    const folder = await makeFolder(userId);
    const first = await createVaultItem(testEnv(), userId, itemInput(folder.id));
    const second = await createVaultItem(testEnv(), userId, itemInput(folder.id));
    if (first.status !== 'created' || second.status !== 'created') throw new Error('item create failed');

    const deleted = await deleteFolder(testEnv(), userId, folder.id);
    expect(deleted.status).toBe('ok');
    if (deleted.status !== 'ok') throw new Error('delete failed');
    expect(deleted.folder.rev).toBe(4);
    expect(deleted.folder.deletedAt).not.toBeNull();

    for (const item of [first.item, second.item]) {
      const row = await findOwnedItem(env.DB, userId, item.id);
      expect(row).toMatchObject({ folder_id: null, rev: 4 });
    }

    const delta = await readVaultDelta(testEnv(), userId, 3, null);
    expect(delta.status).toBe('ok');
    if (delta.status === 'ok') {
      expect(delta.folders).toEqual([expect.objectContaining({ id: folder.id, deletedAt: expect.any(Number) })]);
      expect(delta.items).toHaveLength(2);
      expect(delta.items.every((item) => item.folderId === null && item.rev === 4)).toBe(true);
    }

    const beforeRepeatItems = await env.DB.prepare(
      'SELECT id, folder_id, rev, updated_at FROM vault_items WHERE user_id = ? ORDER BY id',
    )
      .bind(userId)
      .all();
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(4);
    const repeat = await deleteFolder(testEnv(), userId, folder.id);
    expect(repeat.status).toBe('ok');
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(4);
    const afterRepeatItems = await env.DB.prepare(
      'SELECT id, folder_id, rev, updated_at FROM vault_items WHERE user_id = ? ORDER BY id',
    )
      .bind(userId)
      .all();
    expect(afterRepeatItems.results).toEqual(beforeRepeatItems.results);
  });

  it('does not expose another user folder tombstone in the delta', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const folder = await makeFolder(owner);
    await deleteFolder(testEnv(), owner, folder.id);

    const delta = await readVaultDelta(testEnv(), other, 0, null);
    expect(delta.status).toBe('ok');
    if (delta.status === 'ok') expect(delta.folders).toHaveLength(0);
  });

  it('replays an owned client folder id and caps without burning a revision', async () => {
    const userId = await createTestUser();
    const id = crypto.randomUUID();
    const created = await createFolder(testEnv(), userId, { ...folderInput(), id });
    expect(created.status).toBe('created');
    if (created.status !== 'created') throw new Error('folder create failed');
    const rev = (await findVaultRev(env.DB, userId))?.vault_rev;

    const replay = await createFolder(testEnv(), userId, { ...folderInput(), id });
    expect(replay).toMatchObject({ status: 'existing', folder: { id, rev } });
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(rev);
  });

  it('rejects foreign operations and deleted folder references', async () => {
    const userId = await createTestUser();
    const other = await createTestUser();
    const folder = await makeFolder(userId);

    expect((await renameFolder(testEnv(), other, folder.id, { ...folderInput(), rev: 1 })).status).toBe('not-found');
    expect((await deleteFolder(testEnv(), other, folder.id)).status).toBe('not-found');

    const item = await createVaultItem(testEnv(), userId, itemInput(folder.id));
    if (item.status !== 'created') throw new Error('item create failed');
    const current = await findOwnedItem(env.DB, userId, item.item.id);
    await deleteFolder(testEnv(), userId, folder.id);
    expect((await createVaultItem(testEnv(), userId, itemInput(folder.id))).status).toBe('not-found');
    expect(
      (
        await updateVaultItem(testEnv(), userId, item.item.id, {
          ...itemInput(folder.id),
          rev: current!.rev,
        })
      ).status,
    ).toBe('not-found');
    expect((await findOwnedItem(env.DB, userId, item.item.id))?.folder_id).toBeNull();
  }, 20_000);
});

describe('folder bounds', () => {
  it('caps active folders and cleans expired tombstones', async () => {
    const userId = await createTestUser();
    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 500)
       INSERT INTO folders (id, user_id, name_ct, name_iv, data_version, rev, created_at, updated_at)
       SELECT 'folder-' || n, ?, 'bmFtZQ==', 'aXY=', 1, n, 1, 1 FROM seq`,
    )
      .bind(userId)
      .run();
    await env.DB.prepare('UPDATE users SET vault_rev = 500 WHERE id = ?').bind(userId).run();

    expect((await createFolder(testEnv(), userId, folderInput())).status).toBe('limit');

    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await env.DB.prepare('UPDATE folders SET deleted_at = ? WHERE id = ?').bind(old, 'folder-1').run();
    const { runScheduledPurge } = await import('../trash');
    await runScheduledPurge(testEnv(), Date.now());
    expect(await findAnyOwnedFolder(env.DB, userId, 'folder-1')).toBeNull();
  });

  it('keeps item writes closed when the folder is already tombstoned', async () => {
    const userId = await createTestUser();
    const folder = await makeFolder(userId);
    await deleteFolder(testEnv(), userId, folder.id);
    const beforeRev = (await findVaultRev(env.DB, userId))?.vault_rev;
    const vault = createVaultQueries(testEnv());

    const results = await vault.batchCreateItem(crypto.randomUUID(), userId, itemInput(folder.id), Date.now());

    expect(results[1]?.meta.changes).toBe(0);
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(beforeRev);
  });
});
