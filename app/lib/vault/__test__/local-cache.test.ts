import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyVaultDelta, getAllCachedFolders, getAllCachedItems, getSyncState, setSyncState } from '../cache';
import { readKeyMaterial, storeKeyMaterial } from '../key-material';
import { clearVaultKey, setVaultKey } from '../key-store';
import { closeVaultDb, openVaultDb, wipeVaultDb } from '../local-db';
import { getSyncStatus, resetSyncStatus, subscribeSyncStatus, syncVault } from '../sync';
import type { CachedFolder, CachedItem, VaultKeyMaterial } from '../types';

const material = (email: string): VaultKeyMaterial => ({
  vaultKeyWrapped: `wrapped-${email}`,
  vaultKeyWrapIv: 'iv',
  kdfSalt: 'salt',
  kdfIterations: 600_000,
});

const item = (id: string, overrides: Partial<CachedItem> = {}): CachedItem => ({
  id,
  type: 'login',
  folderId: null,
  favorite: false,
  dataCt: 'Y3Q=',
  dataIv: 'aXY=',
  dataVersion: 1,
  rev: 1,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const folder = (id: string, overrides: Partial<CachedFolder> = {}): CachedFolder => ({
  id,
  nameCt: 'bmFtZQ==',
  nameIv: 'aXY=',
  dataVersion: 1,
  rev: 1,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(async () => {
  vi.unstubAllGlobals();
  resetSyncStatus();
  clearVaultKey();
  await closeVaultDb();
  await wipeVaultDb();
});

describe('local vault cache', () => {
  it('round-trips ciphertext rows and keeps tombstones', async () => {
    await applyVaultDelta(
      [item('one'), item('two', { deletedAt: 5, dataCt: '' })],
      [folder('folder', { deletedAt: 6 })],
    );

    expect(await getAllCachedItems()).toHaveLength(2);
    expect((await getAllCachedItems()).find((row) => row.id === 'two')?.deletedAt).toBe(5);
    expect((await getAllCachedFolders())[0]?.deletedAt).toBe(6);
  });

  it('rejects expired or out-of-range key material on read', async () => {
    await storeKeyMaterial('a@example.com', { ...material('a'), kdfIterations: 1 });
    expect(await readKeyMaterial()).toBeNull();

    await storeKeyMaterial('a@example.com', material('a'));
    const db = await openVaultDb();
    const record = await db.get('keys', 'active');
    if (!record) throw new Error('missing key record');
    await db.put('keys', { ...record, storedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 });
    expect(await readKeyMaterial()).toBeNull();
  });

  it('stores wrapped key material and wipes on account switch', async () => {
    await storeKeyMaterial('a@example.com', material('a'));
    await applyVaultDelta([item('one')], []);
    expect((await readKeyMaterial())?.email).toBe('a@example.com');

    await storeKeyMaterial('b@example.com', material('b'));
    expect((await readKeyMaterial())?.email).toBe('b@example.com');
    expect(await getAllCachedItems()).toHaveLength(0);
  });

  it('wipes orphaned cache before storing a new account owner', async () => {
    await applyVaultDelta([item('orphan')], []);
    await storeKeyMaterial('new@example.com', material('new'));

    expect(await getAllCachedItems()).toHaveLength(0);
    expect((await readKeyMaterial())?.email).toBe('new@example.com');
  });

  it('contains no plaintext item fields or unwrapped keys', async () => {
    await storeKeyMaterial('a@example.com', material('a'));
    await applyVaultDelta([item('one')], [folder('folder')]);

    const db = await openVaultDb();
    const records: unknown[] = [];
    for (const store of ['items', 'folders', 'keys', 'sync'] as const) {
      records.push(await db.getAll(store));
    }
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain('my secret name');
    expect(serialized).not.toContain('master password');
    expect(serialized).not.toContain('unwrapped');
    expect(Object.keys((records[2] as Array<Record<string, unknown>>)[0]).sort()).toEqual([
      'email',
      'kdfIterations',
      'kdfSalt',
      'key',
      'storedAt',
      'vaultKeyWrapIv',
      'vaultKeyWrapped',
    ]);
    const itemRecord = (records[0] as Array<Record<string, unknown>>)[0];
    expect(Object.keys(itemRecord).sort()).toEqual([
      'createdAt',
      'dataCt',
      'dataIv',
      'dataVersion',
      'deletedAt',
      'favorite',
      'folderId',
      'id',
      'rev',
      'type',
      'updatedAt',
    ]);
  });
});

const prepareSession = async () => {
  setVaultKey(new Uint8Array(32));
  await storeKeyMaterial('a@example.com', material('a'));
};

describe('vault sync engine', () => {
  it('does nothing when the vault is not unlocked', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await syncVault()).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('follows nextCursor and commits the final watermark', async () => {
    await prepareSession();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ ok: true, serverRev: 2, items: [item('one')], folders: [], nextCursor: 'cursor' }),
      )
      .mockResolvedValueOnce(response({ ok: true, serverRev: 2, items: [item('two')], folders: [] }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await syncVault()).toBe('idle');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('since=0');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('cursor=');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('cursor=cursor');
    expect(await getAllCachedItems()).toHaveLength(2);
    expect(await getSyncState()).toMatchObject({ serverRev: 2, cursor: null });
  });

  it('retains the previous watermark on failure', async () => {
    await prepareSession();
    await setSyncState({ serverRev: 7, cursor: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false }, 500)));

    expect(await syncVault()).toBe('error');
    expect((await getSyncState()).serverRev).toBe(7);
    expect(getSyncStatus()).toBe('error');
  });

  it('skips network work when offline', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('fetch', fetchMock);

    expect(await syncVault()).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('notifies status subscribers and unsubscribes', async () => {
    await prepareSession();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, serverRev: 1, items: [], folders: [] })));
    const statuses: string[] = [];
    const unsubscribe = subscribeSyncStatus((value) => statuses.push(value));
    await syncVault();
    unsubscribe();
    await syncVault();
    expect(statuses).toEqual(['idle', 'syncing', 'idle']);
  });

  it('aborts applying a page when the database is wiped mid-sync', async () => {
    await prepareSession();
    let resolveFetch: ((response: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal('fetch', fetchMock);

    const syncing = syncVault();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await wipeVaultDb();
    resolveFetch!(response({ ok: true, serverRev: 1, items: [item('late')], folders: [] }));
    await syncing;

    expect(await getAllCachedItems()).toHaveLength(0);
  });

  it('returns degraded mode when IndexedDB is unavailable', async () => {
    setVaultKey(new Uint8Array(32));
    vi.stubGlobal('indexedDB', undefined);

    expect(await syncVault()).toBe('degraded');
    expect(getSyncStatus()).toBe('degraded');
    await expect(wipeVaultDb()).resolves.toBeUndefined();
  });
});
