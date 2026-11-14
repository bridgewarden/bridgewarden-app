import { openItem } from '../crypto/envelope';
import { getAllCachedFolders, getAllCachedItems } from './cache';
import { parseFolderPayload, parseItemPayload } from './item-payload';
import { getVaultKey } from './key-store';
import { cachedEnvelope } from './sealed-envelope';
import { isRestorableTombstone } from './trash-count';
import type { CachedFolder, CachedItem } from './types';

export type DecryptedItem = {
  id: string;
  type: 'login' | 'note';
  name: string;
  username: string | null;
  urls: string[];
  notes: string | null;
  body: string | null;
  folderId: string | null;
  folderName: string | null;
  favorite: boolean;
  rev: number;
  createdAt: number;
  updatedAt: number;
};

export type DecryptedFolder = { id: string; name: string; rev: number };
export type TrashedItem = DecryptedItem & { deletedAt: number };

export type VaultProjection = {
  items: DecryptedItem[];
  folders: DecryptedFolder[];
  skipped: number;
};

const CONCURRENCY = 8;

const decryptFolder = async (folder: CachedFolder, key: Uint8Array): Promise<DecryptedFolder | null> => {
  try {
    const payload = parseFolderPayload(
      await openItem(cachedEnvelope(folder.nameCt, folder.nameIv, folder.dataVersion), key, {
        kind: 'folder',
        id: folder.id,
      }),
    );
    return payload ? { id: folder.id, name: payload.name, rev: folder.rev } : null;
  } catch {
    return null;
  }
};

const decryptItem = async (
  item: CachedItem,
  key: Uint8Array,
  folders: Map<string, string>,
): Promise<DecryptedItem | null> => {
  try {
    const payload = parseItemPayload(
      item.type,
      await openItem(cachedEnvelope(item.dataCt, item.dataIv, item.dataVersion), key, {
        kind: 'item',
        id: item.id,
        type: item.type,
      }),
    );
    if (!payload) return null;

    return {
      id: item.id,
      type: item.type,
      name: payload.name,
      username: payload.type === 'login' ? (payload.username ?? null) : null,
      urls: payload.type === 'login' ? (payload.urls ?? []) : [],
      notes: payload.type === 'login' ? (payload.notes ?? null) : null,
      body: payload.type === 'note' ? payload.body : null,
      folderId: item.folderId,
      folderName: item.folderId ? (folders.get(item.folderId) ?? null) : null,
      favorite: item.favorite,
      rev: item.rev,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  } catch {
    return null;
  }
};

const mapLimit = async <T, R>(values: T[], limit: number, task: (value: T) => Promise<R>): Promise<R[]> => {
  const results = new Array<R>(values.length);
  let next = 0;

  const worker = async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await task(values[index]!);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
};

export const readVaultFolders = async (): Promise<DecryptedFolder[]> => {
  const key = getVaultKey();
  if (!key) return [];

  try {
    const cachedFolders = await getAllCachedFolders();
    return (
      await mapLimit(
        cachedFolders.filter((folder) => folder.deletedAt === null),
        CONCURRENCY,
        (folder) => decryptFolder(folder, key),
      )
    )
      .filter((folder): folder is DecryptedFolder => folder !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  } finally {
    key.fill(0);
  }
};

export const readVaultTrash = async (): Promise<TrashedItem[]> => {
  const key = getVaultKey();
  if (!key) return [];

  try {
    const [cachedItems, cachedFolders] = await Promise.all([getAllCachedItems(), getAllCachedFolders()]);
    const decryptedFolders = (
      await mapLimit(
        cachedFolders.filter((folder) => folder.deletedAt === null),
        CONCURRENCY,
        (folder) => decryptFolder(folder, key),
      )
    ).filter((folder): folder is DecryptedFolder => folder !== null);
    const folderNames = new Map(decryptedFolders.map((folder) => [folder.id, folder.name]));
    const tombstones = cachedItems.filter(isRestorableTombstone);
    const decrypted = await mapLimit(tombstones, CONCURRENCY, (item) => decryptItem(item, key, folderNames));

    return decrypted
      .map((item, index) => (item ? { ...item, deletedAt: tombstones[index]!.deletedAt! } : null))
      .filter((item): item is TrashedItem => item !== null)
      .sort((left, right) => right.deletedAt - left.deletedAt);
  } finally {
    key.fill(0);
  }
};

export const readVaultProjection = async (): Promise<VaultProjection> => {
  const key = getVaultKey();
  if (!key) return { items: [], folders: [], skipped: 0 };

  try {
    const [cachedItems, cachedFolders] = await Promise.all([getAllCachedItems(), getAllCachedFolders()]);
    const decryptedFolders = (
      await mapLimit(
        cachedFolders.filter((folder) => folder.deletedAt === null),
        CONCURRENCY,
        (folder) => decryptFolder(folder, key),
      )
    ).filter((folder): folder is DecryptedFolder => folder !== null);

    const folderNames = new Map(decryptedFolders.map((folder) => [folder.id, folder.name]));
    const liveItems = cachedItems.filter((item) => item.deletedAt === null);
    const decryptedItems = await mapLimit(liveItems, CONCURRENCY, (item) => decryptItem(item, key, folderNames));
    const items = decryptedItems.filter((item): item is DecryptedItem => item !== null);

    return {
      items,
      folders: decryptedFolders.sort((left, right) => left.name.localeCompare(right.name)),
      skipped: liveItems.length - items.length + (cachedFolders.length - decryptedFolders.length),
    };
  } finally {
    key.fill(0);
  }
};
