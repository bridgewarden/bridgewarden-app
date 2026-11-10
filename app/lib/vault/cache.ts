import { openVaultDb } from './local-db';
import type { CachedFolder, CachedItem, SyncState } from './types';

export const applyVaultDelta = async (items: CachedItem[], folders: CachedFolder[]): Promise<void> => {
  const db = await openVaultDb();
  const transaction = db.transaction(['items', 'folders'], 'readwrite');
  const itemStore = transaction.objectStore('items');
  const folderStore = transaction.objectStore('folders');

  for (const item of items) itemStore.put(item);
  for (const folder of folders) folderStore.put(folder);
  await transaction.done;
};

export const getAllCachedItems = async (): Promise<CachedItem[]> => {
  const db = await openVaultDb();
  return db.getAll('items');
};

export const getAllCachedFolders = async (): Promise<CachedFolder[]> => {
  const db = await openVaultDb();
  return db.getAll('folders');
};

export const getSyncState = async (): Promise<SyncState> => {
  const db = await openVaultDb();
  return (await db.get('sync', 'active')) ?? { key: 'active', serverRev: 0, cursor: null };
};

export const setSyncState = async (state: Omit<SyncState, 'key'>): Promise<void> => {
  const db = await openVaultDb();
  await db.put('sync', { key: 'active', ...state });
};
