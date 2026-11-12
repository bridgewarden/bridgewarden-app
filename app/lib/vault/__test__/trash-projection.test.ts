import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { sealItem } from '../../crypto/envelope';
import { applyVaultDelta } from '../cache';
import { clearVaultKey, setVaultKey } from '../key-store';
import { closeVaultDb, wipeVaultDb } from '../local-db';
import { readVaultTrash } from '../projection';
import type { CachedFolder, CachedItem } from '../types';

const vaultKey = () => crypto.getRandomValues(new Uint8Array(32));

const item = async (id: string, payload: unknown, deletedAt: number | null, key: Uint8Array, dataCt?: string) => {
  const sealed = await sealItem(payload, key);
  return {
    id,
    type: 'login',
    folderId: 'folder',
    favorite: false,
    dataCt: dataCt ?? sealed.ct,
    dataIv: sealed.iv,
    dataVersion: 1,
    rev: 1,
    deletedAt,
    createdAt: 1,
    updatedAt: 1,
  } satisfies CachedItem;
};

const folder = async (key: Uint8Array): Promise<CachedFolder> => {
  const sealed = await sealItem({ name: 'Work' }, key);
  return {
    id: 'folder',
    nameCt: sealed.ct,
    nameIv: sealed.iv,
    dataVersion: 1,
    rev: 1,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  };
};

beforeEach(async () => {
  clearVaultKey();
  await closeVaultDb();
  await wipeVaultDb();
});

describe('trash projection', () => {
  it('lists restorable tombstones and skips purged or corrupt rows', async () => {
    const key = vaultKey();
    const live = await item('live', { type: 'login', name: 'Live' }, null, key);
    const deleted = await item('deleted', { type: 'login', name: 'Deleted' }, 10, key);
    const missingFolder = {
      ...(await item('missing-folder', { type: 'login', name: 'No folder' }, 5, key)),
      folderId: 'absent',
    };
    const purged = await item('purged', { type: 'login', name: 'Purged' }, 20, key, '');
    await applyVaultDelta([live, deleted, missingFolder, purged], [await folder(key)]);
    setVaultKey(key);

    const result = await readVaultTrash();
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'deleted', name: 'Deleted', folderName: 'Work', deletedAt: 10 }),
      ]),
    );
    expect(result.some((row) => row.id === 'live' || row.id === 'purged')).toBe(false);
    expect(result.find((row) => row.id === 'missing-folder')?.folderName).toBeNull();
  });

  it('skips corrupt tombstones without failing the list', async () => {
    const key = vaultKey();
    const deleted = await item('deleted', { type: 'login', name: 'Deleted' }, 10, key);
    const corrupt = await item('corrupt', { type: 'login', name: 'Corrupt' }, 20, key, 'not-base64');
    await applyVaultDelta([deleted], []);
    const db = await import('../local-db').then(({ openVaultDb }) => openVaultDb());
    await db.put('items', corrupt);
    setVaultKey(key);

    const result = await readVaultTrash();
    expect(result).toHaveLength(1);
  });
});
