import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testEnv } from '../../../__test__/auth-fixtures';
import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { encodeBase64 } from '../../../lib/crypto/encoding';
import { createVaultItem } from '../items';
import { findOwnedItem } from '../queries/items';
import { findVaultRev } from '../queries/rev';
import { purgeVaultItem, restoreVaultItem, runScheduledPurge, TRASH_RETENTION_MS, trashVaultItem } from '../trash';
import type { VaultItemInput } from '../types';

const input = (): VaultItemInput => ({
  type: 'login',
  folderId: null,
  favorite: false,
  dataCt: encodeBase64(new Uint8Array([1, 2, 3])),
  dataIv: encodeBase64(new Uint8Array(12).fill(2)),
  dataVersion: 1,
});

const createItem = async (userId: string) => {
  const result = await createVaultItem(testEnv(), userId, input());
  if (result.status !== 'created') throw new Error('fixture create failed');
  return result.item;
};

beforeEach(async () => {
  await resetDatabase();
});

describe('trash lifecycle', () => {
  it('deletes, restores, and does not burn revisions on repeats', async () => {
    const userId = await createTestUser();
    const item = await createItem(userId);

    const deleted = await trashVaultItem(testEnv(), userId, item.id);
    expect(deleted.status).toBe('ok');
    if (deleted.status !== 'ok') throw new Error('expected delete');
    expect(deleted.item.deletedAt).not.toBeNull();
    expect(deleted.item.rev).toBe(2);

    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(2);
    const repeatedDelete = await trashVaultItem(testEnv(), userId, item.id);
    expect(repeatedDelete.status).toBe('ok');
    if (repeatedDelete.status === 'ok') expect(repeatedDelete.item.rev).toBe(2);
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(2);

    const restored = await restoreVaultItem(testEnv(), userId, item.id);
    expect(restored.status).toBe('ok');
    if (restored.status !== 'ok') throw new Error('expected restore');
    expect(restored.item.deletedAt).toBeNull();
    expect(restored.item.rev).toBe(3);

    const repeatedRestore = await restoreVaultItem(testEnv(), userId, item.id);
    expect(repeatedRestore.status).toBe('ok');
    if (repeatedRestore.status === 'ok') expect(repeatedRestore.item.rev).toBe(3);
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(3);
  });

  it('only purges deleted items and hides foreign items', async () => {
    const userId = await createTestUser();
    const other = await createTestUser();
    const item = await createItem(userId);

    expect((await purgeVaultItem(testEnv(), userId, item.id)).status).toBe('not-found');
    await trashVaultItem(testEnv(), userId, item.id);

    expect((await purgeVaultItem(testEnv(), other, item.id)).status).toBe('not-found');
    expect((await purgeVaultItem(testEnv(), userId, item.id)).status).toBe('ok');
    const purged = await findOwnedItem(env.DB, userId, item.id);
    expect(purged).toMatchObject({ deleted_at: expect.any(Number), data_ct: '', data_iv: '' });
    const revAfterPurge = (await findVaultRev(env.DB, userId))?.vault_rev;

    const repeated = await purgeVaultItem(testEnv(), userId, item.id);
    expect(repeated.status).toBe('ok');
    if (repeated.status === 'ok') expect(repeated.item.rev).toBe(revAfterPurge);
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(revAfterPurge);
  });

  it('returns not-found for foreign trash and restore', async () => {
    const userId = await createTestUser();
    const other = await createTestUser();
    const item = await createItem(userId);

    expect((await trashVaultItem(testEnv(), other, item.id)).status).toBe('not-found');
    await trashVaultItem(testEnv(), userId, item.id);
    expect((await restoreVaultItem(testEnv(), other, item.id)).status).toBe('not-found');
  });
});

describe('scheduled purge', () => {
  it('removes expired tombstones across batches and keeps recent ones', async () => {
    const userId = await createTestUser();
    const now = Date.now();
    const cutoff = now - TRASH_RETENTION_MS;

    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 1001)
       INSERT INTO vault_items (id, user_id, type, favorite, data_ct, data_iv, data_version, rev, deleted_at, created_at, updated_at)
       SELECT 'expired-' || n, ?, 'login', 0, 'Y3Q=', 'aXY=', 1, n, ?, 1, 1 FROM seq`,
    )
      .bind(userId, cutoff - 1)
      .run();
    await env.DB.prepare(
      `INSERT INTO vault_items (id, user_id, type, favorite, data_ct, data_iv, data_version, rev, deleted_at, created_at, updated_at)
       VALUES ('recent', ?, 'login', 0, 'Y3Q=', 'aXY=', 1, 1002, ?, 1, 1)`,
    )
      .bind(userId, cutoff + 1)
      .run();
    await env.DB.prepare('UPDATE users SET vault_rev = 1002 WHERE id = ?').bind(userId).run();

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await runScheduledPurge(testEnv(), now)).toBe(1001);
    expect(log).toHaveBeenCalledWith('vault.purge', 1001);
    log.mockRestore();
    expect(await findOwnedItem(env.DB, userId, 'recent')).not.toBeNull();
    expect(await findOwnedItem(env.DB, userId, 'expired-1')).toBeNull();
  });
});
