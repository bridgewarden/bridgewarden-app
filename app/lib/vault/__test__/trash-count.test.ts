import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { applyVaultDelta } from '../cache';
import { closeVaultDb, wipeVaultDb } from '../local-db';
import { getTrashCount, refreshTrashCount, resetTrashCount } from '../trash-count';

const item = (id: string, deletedAt: number | null, dataCt: string) => ({
  id,
  type: 'login' as const,
  folderId: null,
  favorite: false,
  dataCt,
  dataIv: 'aXY=',
  dataVersion: 1,
  rev: 1,
  deletedAt,
  createdAt: 1,
  updatedAt: 1,
});

beforeEach(async () => {
  resetTrashCount();
  await closeVaultDb();
  await wipeVaultDb();
});

describe('trash count', () => {
  it('counts only restorable tombstones', async () => {
    await applyVaultDelta([item('live', null, 'Y3Q='), item('trash', 1, 'Y3Q='), item('purged', 2, '')], []);
    await expect(refreshTrashCount()).resolves.toBe(1);
    expect(getTrashCount()).toBe(1);
  });

  it('resets to zero after a vault wipe', async () => {
    await applyVaultDelta([item('trash', 1, 'Y3Q=')], []);
    await refreshTrashCount();
    await wipeVaultDb();
    await expect(refreshTrashCount()).resolves.toBe(0);
    expect(getTrashCount()).toBe(0);
  });
});
