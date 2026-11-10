import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openDB } from 'idb';

import { getAllCachedFolders, getAllCachedItems } from '../cache';
import { storeKeyMaterial } from '../key-material';
import { setVaultKey } from '../key-store';

import { closeVaultDb, openVaultDb, VAULT_DB_NAME, wipeVaultDb } from '../local-db';
import { enqueueOutbox, flushOutbox, getOutboxEntries, subscribeOutboxEvents } from '../outbox';
import type { CachedFolder, CachedItem, OutboxEntry } from '../types';

const item = (id: string, rev = 1, overrides: Partial<CachedItem> = {}): CachedItem => ({
  id,
  type: 'login',
  folderId: null,
  favorite: false,
  dataCt: 'Y3Q=',
  dataIv: 'aXY=',
  dataVersion: 1,
  rev,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const createEntry = (id: string, optimistic = item(id)): OutboxEntry => ({
  kind: 'item.create',
  id,
  idempotencyId: id,
  entity: 'item',
  optimistic,
  previous: null,
  payload: {
    id,
    type: 'login',
    folderId: null,
    favorite: false,
    dataCt: 'Y3Q=',
    dataIv: 'aXY=',
    dataVersion: 1,
  },
  queuedAt: 1,
});

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const ID1 = crypto.randomUUID();
const ID2 = crypto.randomUUID();

const prepareSession = async () => {
  setVaultKey(new Uint8Array(32));
  await storeKeyMaterial('a@example.com', {
    vaultKeyWrapped: 'wrapped',
    vaultKeyWrapIv: 'iv',
    kdfSalt: 'salt',
    kdfIterations: 600_000,
  });
};

beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await closeVaultDb();
  await wipeVaultDb();
});

describe('vault outbox', () => {
  it('upgrades a version-1 database and preserves existing rows', async () => {
    const legacy = await openDB(VAULT_DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('items', { keyPath: 'id' });
        db.createObjectStore('folders', { keyPath: 'id' });
        db.createObjectStore('keys', { keyPath: 'key' });
        db.createObjectStore('sync', { keyPath: 'key' });
      },
    });
    await legacy.put('items', item('legacy'));
    await legacy.put('folders', {
      id: 'legacy-folder',
      nameCt: 'bmFtZQ==',
      nameIv: 'aXY=',
      dataVersion: 1,
      rev: 1,
      deletedAt: null,
      createdAt: 1,
      updatedAt: 1,
    });
    await legacy.put('keys', {
      key: 'active',
      email: 'legacy@example.com',
      vaultKeyWrapped: 'wrapped',
      vaultKeyWrapIv: 'iv',
      kdfSalt: 'salt',
      kdfIterations: 600_000,
      storedAt: Date.now(),
    });
    await legacy.put('sync', { key: 'active', serverRev: 4, cursor: null });
    legacy.close();

    const upgraded = await openVaultDb();
    expect([...upgraded.objectStoreNames].sort()).toEqual(['folders', 'items', 'keys', 'outbox', 'sync']);
    expect(await upgraded.get('items', 'legacy')).toMatchObject({ id: 'legacy' });
    expect(await upgraded.get('folders', 'legacy-folder')).toMatchObject({ id: 'legacy-folder' });
    expect(await upgraded.get('keys', 'active')).toMatchObject({ email: 'legacy@example.com' });
    expect(await upgraded.get('sync', 'active')).toMatchObject({ serverRev: 4 });
  });
  it('rejects create ids that are not UUID and plaintext payload keys', async () => {
    await expect(
      enqueueOutbox({ ...createEntry('not-a-uuid'), id: 'not-a-uuid', idempotencyId: null }),
    ).rejects.toThrow('UUID');
    await expect(
      enqueueOutbox({ ...createEntry(crypto.randomUUID()), payload: { password: 'plaintext' } }),
    ).rejects.toThrow('ciphertext-only');
  });

  it('persists optimistic rows and survives reopen', async () => {
    await enqueueOutbox(createEntry(ID1));
    await closeVaultDb();
    await closeVaultDb();

    expect(await getOutboxEntries()).toHaveLength(1);
    expect(await getAllCachedItems()).toEqual([expect.objectContaining({ id: ID1, rev: 1 })]);
  });

  it('flushes in order and replaces optimistic rows with server rows', async () => {
    await prepareSession();
    await enqueueOutbox(createEntry(ID1));
    await enqueueOutbox(createEntry(ID2));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true, item: item(ID1, 2) }))
      .mockResolvedValueOnce(response({ ok: true, item: item(ID2, 3) }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await flushOutbox()).toBe(2);
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).id)).toEqual([ID1, ID2]);
    expect(await getOutboxEntries()).toHaveLength(0);
    expect((await getAllCachedItems()).map((row) => row.rev).sort()).toEqual([2, 3]);
  });

  it('stops on the first server failure and keeps later entries', async () => {
    await prepareSession();
    await enqueueOutbox(createEntry(ID1));
    await enqueueOutbox(createEntry(ID2));
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ ok: false }, 500));
    vi.stubGlobal('fetch', fetchMock);

    expect(await flushOutbox()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getOutboxEntries()).toHaveLength(2);
  });

  it('rolls back on 409, removes the entry, and emits conflict', async () => {
    await prepareSession();
    const previous = item(ID1, 1, { favorite: false });
    const optimistic = item(ID1, 1, { favorite: true });
    await enqueueOutbox({
      ...createEntry(ID1, optimistic),
      kind: 'item.update',
      previous,
      payload: { ...createEntry(ID1).payload, favorite: true, rev: 1 },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false, error: 'conflict' }, 409)));
    const events: string[] = [];
    const unsubscribe = subscribeOutboxEvents((event) => events.push(event.type));

    expect(await flushOutbox()).toBe(1);
    unsubscribe();
    expect(await getOutboxEntries()).toHaveLength(0);
    expect(await getAllCachedItems()).toEqual([expect.objectContaining({ id: ID1, favorite: false })]);
    expect(events).toEqual(['conflict']);
  });

  it('drops validation failures without retrying', async () => {
    await prepareSession();
    await enqueueOutbox(createEntry(ID1));
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: false }, 400));
    vi.stubGlobal('fetch', fetchMock);

    expect(await flushOutbox()).toBe(1);
    expect(await getOutboxEntries()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps entries on network rejection', async () => {
    await prepareSession();
    await enqueueOutbox(createEntry(ID1));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    expect(await flushOutbox()).toBe(0);
    expect(await getOutboxEntries()).toHaveLength(1);
  });

  it('rolls back and removes an entry on 404', async () => {
    await prepareSession();
    await enqueueOutbox({
      ...createEntry(ID1),
      kind: 'item.update',
      previous: item(ID1),
      optimistic: item(ID1, 1, { favorite: true }),
      payload: { ...createEntry(ID1).payload, favorite: true, rev: 1 },
    });
    const events: string[] = [];
    const unsubscribe = subscribeOutboxEvents((event) => events.push(event.type));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false }, 404)));

    expect(await flushOutbox()).toBe(1);
    unsubscribe();
    expect(await getOutboxEntries()).toHaveLength(0);
    expect(await getAllCachedItems()).toEqual([expect.objectContaining({ id: ID1, favorite: false })]);
    expect(events).toEqual(['error']);
  });

  it('aborts writes when the database is wiped mid-flush', async () => {
    await prepareSession();
    await enqueueOutbox(createEntry(ID1));
    let resolveFetch: ((response: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal('fetch', fetchMock);

    const flushing = flushOutbox();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await wipeVaultDb();
    resolveFetch!(response({ ok: true, item: item(ID1, 2) }));

    expect(await flushing).toBe(0);
    expect(await getAllCachedItems()).toHaveLength(0);
  });

  it('wipes the outbox with all stores', async () => {
    await enqueueOutbox(createEntry(ID1));
    await wipeVaultDb();

    expect(await getOutboxEntries()).toHaveLength(0);
    expect(await getAllCachedItems()).toHaveLength(0);
  });
});

describe('outbox operation mapping', () => {
  it('maps restore, purge, rename, and folder delete', async () => {
    await prepareSession();
    const folderId = crypto.randomUUID();
    const folder: CachedFolder = {
      id: folderId,
      nameCt: 'bmFtZQ==',
      nameIv: 'aXY=',
      dataVersion: 1,
      rev: 1,
      deletedAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    await enqueueOutbox({
      kind: 'item.restore',
      id: ID1,
      idempotencyId: null,
      entity: 'item',
      payload: {},
      previous: item(ID1, 1, { deletedAt: 2 }),
      optimistic: item(ID1, 1),
      queuedAt: 1,
    });
    await enqueueOutbox({
      kind: 'item.purge',
      id: ID2,
      idempotencyId: null,
      entity: 'item',
      payload: {},
      previous: item(ID2, 1, { deletedAt: 2 }),
      optimistic: item(ID2, 1, { deletedAt: 2, dataCt: '', dataIv: '' }),
      queuedAt: 2,
    });
    await enqueueOutbox({
      kind: 'folder.rename',
      id: folderId,
      idempotencyId: null,
      entity: 'folder',
      payload: { nameCt: 'bmFtZQ==', nameIv: 'aXY=', dataVersion: 1, rev: 1 },
      previous: folder,
      optimistic: folder,
      queuedAt: 3,
    });
    await enqueueOutbox({
      kind: 'folder.delete',
      id: folderId,
      idempotencyId: null,
      entity: 'folder',
      payload: {},
      previous: folder,
      optimistic: { ...folder, deletedAt: 3 },
      queuedAt: 4,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true, item: item(ID1, 1) }))
      .mockResolvedValueOnce(response({ ok: true, item: item(ID2, 1, { deletedAt: 2, dataCt: '', dataIv: '' }) }))
      .mockResolvedValueOnce(response({ ok: true, folder }))
      .mockResolvedValueOnce(response({ ok: true, folder: { ...folder, deletedAt: 3 } }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await flushOutbox()).toBe(4);
    expect(fetchMock.mock.calls.map((call) => [call[0], (call[1] as RequestInit)?.method])).toEqual([
      [`/api/vault/items/${ID1}/restore`, 'POST'],
      [`/api/vault/items/${ID2}/purge`, 'POST'],
      [`/api/folders/${folderId}`, 'PATCH'],
      [`/api/folders/${folderId}`, 'DELETE'],
    ]);
  });

  it('maps folder create and item trash to the correct endpoints', async () => {
    await prepareSession();
    const folder: CachedFolder = {
      id: crypto.randomUUID(),
      nameCt: 'bmFtZQ==',
      nameIv: 'aXY=',
      dataVersion: 1,
      rev: 1,
      deletedAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    await enqueueOutbox({
      kind: 'folder.create',
      id: folder.id,
      idempotencyId: null,
      entity: 'folder',
      payload: { nameCt: 'bmFtZQ==', nameIv: 'aXY=', dataVersion: 1 },
      previous: null,
      optimistic: folder,
      queuedAt: 1,
    });
    await enqueueOutbox({
      kind: 'item.trash',
      id: ID1,
      idempotencyId: null,
      entity: 'item',
      payload: {},
      previous: item(ID1),
      optimistic: item(ID1, 1, { deletedAt: 2 }),
      queuedAt: 2,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true, folder }))
      .mockResolvedValueOnce(response({ ok: true, item: item(ID1, 1, { deletedAt: 2 }) }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await flushOutbox()).toBe(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/folders');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/vault/items/${ID1}`);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(await getAllCachedFolders()).toEqual([expect.objectContaining({ id: folder.id })]);
  });
});
