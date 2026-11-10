import { getDatabase } from '../../../lib/.server/db';
import type { VaultItemInput } from '../types';
import {
  batchCreateFolder,
  batchDeleteFolder,
  batchRenameFolder,
  deleteExpiredFoldersBatch,
  findAnyOwnedFolder,
  findOwnedFolder,
  listActiveFolders,
} from './folders';
import {
  batchCreateItem,
  batchRestoreItem,
  batchTrashItem,
  batchUpdateItem,
  deleteExpiredItemsBatch,
  findOwnedItem,
  batchPurgeItem,
} from './items';
import { findVaultRev } from './rev';
import { listVaultDelta } from './sync';

export const createVaultQueries = (env: Env) => {
  const db = getDatabase(env);
  return {
    findVaultRev: (userId: string) => findVaultRev(db, userId),
    findOwnedItem: (userId: string, itemId: string) => findOwnedItem(db, userId, itemId),
    findOwnedFolder: (userId: string, folderId: string) => findOwnedFolder(db, userId, folderId),
    findAnyOwnedFolder: (userId: string, folderId: string) => findAnyOwnedFolder(db, userId, folderId),
    listActiveFolders: (userId: string, limit: number) => listActiveFolders(db, userId, limit),
    batchCreateFolder: (id: string, userId: string, input: import('../types').VaultFolderInput, now: number) =>
      batchCreateFolder(db, id, userId, input, now),
    batchRenameFolder: (
      userId: string,
      folderId: string,
      expectedRev: number,
      input: import('../types').VaultFolderInput,
      now: number,
    ) => batchRenameFolder(db, userId, folderId, expectedRev, input, now),
    batchDeleteFolder: (userId: string, folderId: string, now: number) => batchDeleteFolder(db, userId, folderId, now),
    batchCreateItem: (id: string, userId: string, input: VaultItemInput, now: number) =>
      batchCreateItem(db, id, userId, input, now),
    batchUpdateItem: (userId: string, itemId: string, expectedRev: number, input: VaultItemInput, now: number) =>
      batchUpdateItem(db, userId, itemId, expectedRev, input, now),
    batchTrashItem: (userId: string, itemId: string, now: number) => batchTrashItem(db, userId, itemId, now),
    batchRestoreItem: (userId: string, itemId: string, now: number) => batchRestoreItem(db, userId, itemId, now),
    purgeItem: (userId: string, itemId: string) => batchPurgeItem(db, userId, itemId, Date.now()),
    deleteExpiredItemsBatch: (cutoff: number, limit: number) => deleteExpiredItemsBatch(db, cutoff, limit),
    deleteExpiredFoldersBatch: (cutoff: number, limit: number) => deleteExpiredFoldersBatch(db, cutoff, limit),
    listVaultDelta: (userId: string, since: number, cursor: { rev: number; id: string } | null, limit?: number) =>
      listVaultDelta(db, userId, since, cursor, limit),
  };
};
