import type { VaultItemInput } from '../types';
import {
  incrementVaultRevForNewItem,
  incrementVaultRevIfItem,
  incrementVaultRevIfItemDeleted,
  incrementVaultRevIfItemLive,
  incrementVaultRevIfItemUnpurged,
} from './rev';

export type VaultItemRow = {
  id: string;
  type: 'login' | 'note';
  folder_id: string | null;
  favorite: number;
  data_ct: string;
  data_iv: string;
  data_version: number;
  rev: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

const ITEM_COLUMNS = `id, type, folder_id, favorite, data_ct, data_iv, data_version, rev, deleted_at, created_at, updated_at`;

export const findOwnedItem = (db: D1Database, userId: string, itemId: string): Promise<VaultItemRow | null> =>
  db
    .prepare(`SELECT ${ITEM_COLUMNS} FROM vault_items WHERE id = ? AND user_id = ?`)
    .bind(itemId, userId)
    .first<VaultItemRow>();

export const insertItemStatement = (
  db: D1Database,
  id: string,
  userId: string,
  input: VaultItemInput,
  now: number,
): D1PreparedStatement =>
  db
    .prepare(
      `INSERT OR IGNORE INTO vault_items (
        id, user_id, folder_id, type, favorite, data_ct, data_iv, data_version, rev,
        deleted_at, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, vault_rev, NULL, ?, ?
      FROM users WHERE id = ?
        AND NOT EXISTS (SELECT 1 FROM vault_items WHERE id = ?)
        AND (? IS NULL OR EXISTS (
          SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL
        ))
      RETURNING ${ITEM_COLUMNS}`,
    )
    .bind(
      id,
      userId,
      input.folderId,
      input.type,
      input.favorite ? 1 : 0,
      input.dataCt,
      input.dataIv,
      input.dataVersion,
      now,
      now,
      userId,
      id,
      input.folderId,
      input.folderId,
      userId,
    );

export const updateItemStatement = (
  db: D1Database,
  userId: string,
  itemId: string,
  expectedRev: number,
  input: VaultItemInput,
  now: number,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE vault_items
       SET type = ?, folder_id = ?, favorite = ?, data_ct = ?, data_iv = ?, data_version = ?,
           rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
       WHERE id = ? AND user_id = ? AND rev = ? AND deleted_at IS NULL
         AND (? IS NULL OR EXISTS (
           SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         ))
       RETURNING ${ITEM_COLUMNS}`,
    )
    .bind(
      input.type,
      input.folderId,
      input.favorite ? 1 : 0,
      input.dataCt,
      input.dataIv,
      input.dataVersion,
      userId,
      now,
      itemId,
      userId,
      expectedRev,
      input.folderId,
      input.folderId,
      userId,
    );

export const batchCreateItem = (
  db: D1Database,
  id: string,
  userId: string,
  input: VaultItemInput,
  now: number,
): Promise<D1Result[]> =>
  db.batch([
    incrementVaultRevForNewItem(db, userId, input.folderId, id),
    insertItemStatement(db, id, userId, input, now),
  ]);

export const batchUpdateItem = (
  db: D1Database,
  userId: string,
  itemId: string,
  expectedRev: number,
  input: VaultItemInput,
  now: number,
): Promise<D1Result[]> =>
  db.batch([
    incrementVaultRevIfItem(db, userId, itemId, expectedRev, input.folderId),
    updateItemStatement(db, userId, itemId, expectedRev, input, now),
  ]);

const trashItemStatement = (db: D1Database, userId: string, itemId: string, now: number): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE vault_items
       SET deleted_at = ?, rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL
       RETURNING ${ITEM_COLUMNS}`,
    )
    .bind(now, userId, now, itemId, userId);

const restoreItemStatement = (db: D1Database, userId: string, itemId: string, now: number): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE vault_items
       SET deleted_at = NULL, rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND data_ct <> '' AND data_iv <> ''
       RETURNING ${ITEM_COLUMNS}`,
    )
    .bind(userId, now, itemId, userId);

const purgeItemStatement = (db: D1Database, userId: string, itemId: string, now: number): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE vault_items
       SET data_ct = '', data_iv = '', rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND data_ct <> ''
       RETURNING ${ITEM_COLUMNS}`,
    )
    .bind(userId, now, itemId, userId);

export const batchTrashItem = (db: D1Database, userId: string, itemId: string, now: number): Promise<D1Result[]> =>
  db.batch([incrementVaultRevIfItemLive(db, userId, itemId), trashItemStatement(db, userId, itemId, now)]);

export const batchRestoreItem = (db: D1Database, userId: string, itemId: string, now: number): Promise<D1Result[]> =>
  db.batch([incrementVaultRevIfItemDeleted(db, userId, itemId), restoreItemStatement(db, userId, itemId, now)]);

export const batchPurgeItem = (db: D1Database, userId: string, itemId: string, now: number): Promise<D1Result[]> =>
  db.batch([incrementVaultRevIfItemUnpurged(db, userId, itemId), purgeItemStatement(db, userId, itemId, now)]);

export const deleteExpiredItemsBatch = (db: D1Database, cutoff: number, limit: number): Promise<D1Result> =>
  db
    .prepare(
      `DELETE FROM vault_items
       WHERE id IN (
         SELECT id FROM vault_items WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT ?
       )`,
    )
    .bind(cutoff, limit)
    .run();
