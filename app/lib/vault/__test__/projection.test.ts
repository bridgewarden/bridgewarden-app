import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { sealItem } from '../../crypto/envelope';
import { applyVaultDelta } from '../cache';
import { clearVaultKey, setVaultKey } from '../key-store';
import { closeVaultDb, wipeVaultDb } from '../local-db';
import { readVaultProjection } from '../projection';
import type { CachedFolder, CachedItem } from '../types';

const key = () => crypto.getRandomValues(new Uint8Array(32));

const folder = async (
  id: string,
  payload: unknown,
  vaultKey: Uint8Array,
  overrides: Partial<CachedFolder> = {},
): Promise<CachedFolder> => {
  const sealed = await sealItem(payload, vaultKey, { kind: 'folder', id });
  return {
    id,
    nameCt: sealed.ct,
    nameIv: sealed.iv,
    dataVersion: 2,
    rev: 1,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
};

const item = async (
  id: string,
  type: 'login' | 'note',
  payload: unknown,
  vaultKey: Uint8Array,
  overrides: Partial<CachedItem> = {},
): Promise<CachedItem> => {
  const sealed = await sealItem(payload, vaultKey, { kind: 'item', id, type });
  return {
    id,
    type,
    folderId: null,
    favorite: false,
    dataCt: sealed.ct,
    dataIv: sealed.iv,
    dataVersion: 2,
    rev: 1,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
};

beforeEach(async () => {
  clearVaultKey();
  await closeVaultDb();
  await wipeVaultDb();
});

describe('vault projection', () => {
  it('decrypts valid items and folders while skipping corrupt rows', async () => {
    const vaultKey = key();
    setVaultKey(vaultKey);
    const validFolder = await folder('folder-a', { name: 'Family' }, vaultKey);
    const invalidFolder = await folder('folder-b', { wrong: true }, vaultKey);
    const login = await item(
      'login',
      'login',
      { type: 'login', name: 'Email', username: 'me@example.com', urls: ['https://example.com'] },
      vaultKey,
      { folderId: 'folder-a', favorite: true },
    );
    const note = await item('note', 'note', { type: 'note', name: 'Recovery', body: 'text' }, vaultKey, {
      folderId: 'folder-b',
    });
    const corrupt = await item('corrupt', 'login', { type: 'login', name: 'Bad' }, vaultKey, { dataCt: 'AAAA' });
    const deleted = await item('deleted', 'login', { type: 'login', name: 'Gone' }, vaultKey, { deletedAt: 2 });

    await applyVaultDelta([login, note, corrupt, deleted], [validFolder, invalidFolder]);
    vaultKey.fill(0);

    const projection = await readVaultProjection();
    expect(projection.folders).toEqual([{ id: 'folder-a', name: 'Family', rev: 1 }]);
    expect(projection.items).toHaveLength(2);
    expect(projection.items.find((row) => row.id === 'login')).toMatchObject({
      name: 'Email',
      username: 'me@example.com',
      folderName: 'Family',
      favorite: true,
    });
    expect(projection.items.find((row) => row.id === 'note')).toMatchObject({
      name: 'Recovery',
      username: null,
      folderName: null,
      body: 'text',
    });
    expect(projection.skipped).toBe(2);
  });

  it('projects 500 rows without failing', async () => {
    const vaultKey = key();
    setVaultKey(vaultKey);
    const rows: CachedItem[] = await Promise.all(
      Array.from({ length: 500 }, async (_, index) => {
        const id = `item-${index}`;
        const sealed = await sealItem({ type: 'login', name: 'Many' }, vaultKey, {
          kind: 'item',
          id,
          type: 'login',
        });
        return {
          id,
          type: 'login' as const,
          folderId: null,
          favorite: false,
          dataCt: sealed.ct,
          dataIv: sealed.iv,
          dataVersion: 2,
          rev: index + 1,
          deletedAt: null,
          createdAt: 1,
          updatedAt: 1,
        };
      }),
    );

    await applyVaultDelta(rows, []);
    const projection = await readVaultProjection();
    expect(projection.items).toHaveLength(500);
    expect(projection.skipped).toBe(0);
  });

  it('returns an empty projection while locked', async () => {
    await expect(readVaultProjection()).resolves.toEqual({ items: [], folders: [], skipped: 0 });
  });
});
