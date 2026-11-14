import type { VaultItemInput } from '../types';
import {
  incrementVaultRevForNewItem,
  incrementVaultRevIfItem,
  incrementVaultRevIfItemDeleted,
  incrementVaultRevIfItemLive,
  incrementVaultRevIfItemUnpurged,
} from './rev';
import { MAX_ITEM_BYTES, type PurgeBatchResult } from '../types';
import { ITEM_QUOTA_SQL, itemQuotaBind, type ItemUsage } from './quota';

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
        ${ITEM_QUOTA_SQL}
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
      ...itemQuotaBind(userId, input.dataCt.length),
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
         AND (SELECT COALESCE(SUM(LENGTH(data_ct)), 0) FROM vault_items WHERE user_id = ? AND id <> ?) + ? <= ?
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
      userId,
      itemId,
      input.dataCt.length,
      (MAX_ITEM_BYTES * 4) / 3,
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
    incrementVaultRevForNewItem(db, userId, input.folderId, id, input.dataCt.length),
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
    incrementVaultRevIfItem(db, userId, itemId, expectedRev, input.folderId, input.dataCt.length),
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

export const deleteExpiredItemsBatch = async (
  db: D1Database,
  cutoff: number,
  limit: number,
): Promise<PurgeBatchResult> => {
  const rows = await db
    .prepare(
      `SELECT id FROM vault_items
       WHERE deleted_at IS NOT NULL AND deleted_at < ? AND data_ct <> ''
       LIMIT ?`,
    )
    .bind(cutoff, limit)
    .all<{ id: string }>();
  const selected = rows.results ?? [];
  const ids = selected.map((row) => row.id);
  if (ids.length === 0) return { changes: 0, userIds: [] };
  const encoded = JSON.stringify(ids);
  const results = await db.batch([
    db
      .prepare(
        `UPDATE users SET vault_rev = vault_rev + 1
         WHERE id IN (
           SELECT DISTINCT user_id FROM vault_items
           WHERE id IN (SELECT value FROM json_each(?))
             AND deleted_at IS NOT NULL AND deleted_at < ? AND data_ct <> ''
         )`,
      )
      .bind(encoded, cutoff),
    db
      .prepare(
        `UPDATE vault_items
         SET data_ct = '', data_iv = '', rev = (SELECT vault_rev FROM users WHERE id = vault_items.user_id)
         WHERE id IN (SELECT value FROM json_each(?))
           AND deleted_at IS NOT NULL AND deleted_at < ? AND data_ct <> ''
         RETURNING user_id`,
      )
      .bind(encoded, cutoff),
  ]);
  const erased = (results[1]?.results ?? []) as { user_id: string }[];
  return { changes: results[1]?.meta.changes ?? 0, userIds: [...new Set(erased.map((row) => row.user_id))] };
};

export const findItemUsage = async (db: D1Database, userId: string): Promise<ItemUsage | null> => {
  const row = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS active,
         COUNT(*) AS rows,
         COALESCE(SUM(LENGTH(data_ct)), 0) AS bytes
       FROM vault_items WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ active: number; rows: number; bytes: number }>();
  return row ? { active: row.active ?? 0, rows: row.rows ?? 0, bytes: row.bytes } : null;
};
