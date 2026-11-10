import { getDatabase } from '../../../lib/.server/db';
import type { VaultItemInput } from '../types';
import { findOwnedFolder } from './folders';
import { batchCreateItem, batchUpdateItem, findOwnedItem } from './items';
import { findVaultRev } from './rev';
import { listVaultDelta } from './sync';

export const createVaultQueries = (env: Env) => {
  const db = getDatabase(env);
  return {
    findVaultRev: (userId: string) => findVaultRev(db, userId),
    findOwnedItem: (userId: string, itemId: string) => findOwnedItem(db, userId, itemId),
    findOwnedFolder: (userId: string, folderId: string) => findOwnedFolder(db, userId, folderId),
    batchCreateItem: (id: string, userId: string, input: VaultItemInput, now: number) =>
      batchCreateItem(db, id, userId, input, now),
    batchUpdateItem: (userId: string, itemId: string, expectedRev: number, input: VaultItemInput, now: number) =>
      batchUpdateItem(db, userId, itemId, expectedRev, input, now),
    listVaultDelta: (userId: string, since: number, cursor: { rev: number; id: string } | null, limit?: number) =>
      listVaultDelta(db, userId, since, cursor, limit),
  };
};
