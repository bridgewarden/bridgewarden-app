import { storedToStandardBase64 } from '../base64-url';
import { openVaultDb } from './local-db';
import type { CachedFolder, CachedItem, SyncState } from './types';

export const applyVaultDelta = async (items: CachedItem[], folders: CachedFolder[]): Promise<void> => {
  const db = await openVaultDb();
  const transaction = db.transaction(['items', 'folders'], 'readwrite');
  const itemStore = transaction.objectStore('items');
  const folderStore = transaction.objectStore('folders');

  for (const item of items)
    itemStore.put({
      ...item,
      dataCt: storedToStandardBase64(item.dataCt),
      dataIv: storedToStandardBase64(item.dataIv),
    });
  for (const folder of folders)
    folderStore.put({
      ...folder,
      nameCt: storedToStandardBase64(folder.nameCt),
      nameIv: storedToStandardBase64(folder.nameIv),
    });
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
