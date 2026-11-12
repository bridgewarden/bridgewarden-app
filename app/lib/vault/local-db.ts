import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { CachedFolder, CachedItem, OutboxEntry, StoredKeyMaterial, SyncState } from './types';

export const VAULT_DB_NAME = 'bridgewarden-vault';
export const VAULT_DB_VERSION = 3;

interface VaultDatabase extends DBSchema {
  items: { key: string; value: CachedItem };
  folders: { key: string; value: CachedFolder };
  keys: { key: 'active'; value: StoredKeyMaterial };
  sync: { key: 'active'; value: SyncState };
  outbox: { key: number; value: OutboxEntry };
  meta: { key: string; value: { key: string; preferences: unknown } };
}

export class VaultDbUnavailableError extends Error {}

let dbPromise: Promise<IDBPDatabase<VaultDatabase>> | null = null;
let epoch = 0;
let queue: Promise<unknown> = Promise.resolve();

const hasIndexedDb = (): boolean => typeof globalThis.indexedDB !== 'undefined';

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const closeNow = async (): Promise<void> => {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  db?.close();
  dbPromise = null;
};

const openNow = async (): Promise<IDBPDatabase<VaultDatabase>> => {
  if (!hasIndexedDb()) throw new VaultDbUnavailableError();

  dbPromise ??= openDB<VaultDatabase>(VAULT_DB_NAME, VAULT_DB_VERSION, {
    blocking() {
      const current = dbPromise;
      dbPromise = null;
      void current?.then((db) => db.close()).catch(() => undefined);
    },
    blocked() {
      dbPromise = null;
    },
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('items', { keyPath: 'id' });
        db.createObjectStore('folders', { keyPath: 'id' });
        db.createObjectStore('keys', { keyPath: 'key' });
        db.createObjectStore('sync', { keyPath: 'key' });
      }
      if (oldVersion < 2) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      if (oldVersion < 3) db.createObjectStore('meta', { keyPath: 'key' });
    },
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
};

export const openVaultDb = (): Promise<IDBPDatabase<VaultDatabase>> => enqueue(openNow);

export const closeVaultDb = (): Promise<void> => enqueue(closeNow);

export const wipeVaultDb = (): Promise<void> =>
  enqueue(async () => {
    epoch += 1;
    await closeNow();
    if (!hasIndexedDb()) return;

    await deleteDB(VAULT_DB_NAME, {
      blocked() {
        void closeNow();
      },
    });
  });

export const getVaultEpoch = (): number => epoch;
