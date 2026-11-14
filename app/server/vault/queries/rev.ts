import { MAX_ACTIVE_FOLDERS, MAX_FOLDER_ROWS, MAX_ITEM_BYTES } from '../types';
import { ITEM_QUOTA_SQL, itemQuotaBind } from './quota';

export type VaultRevRow = { vault_rev: number };

export const findVaultRev = (db: D1Database, userId: string): Promise<VaultRevRow | null> =>
  db.prepare('SELECT vault_rev FROM users WHERE id = ?').bind(userId).first<VaultRevRow>();

export const incrementVaultRev = (db: D1Database, userId: string, now: number): D1PreparedStatement =>
  db.prepare('UPDATE users SET vault_rev = vault_rev + 1, updated_at = ? WHERE id = ?').bind(now, userId);

export const incrementVaultRevForNewItem = (
  db: D1Database,
  userId: string,
  folderId: string | null,
  itemId: string,
  newBytes: number,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND NOT EXISTS (SELECT 1 FROM vault_items WHERE id = ?)
         ${ITEM_QUOTA_SQL}
         AND (? IS NULL OR EXISTS (
           SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         ))`,
    )
    .bind(userId, itemId, ...itemQuotaBind(userId, newBytes), folderId, folderId, userId);

export const incrementVaultRevIfItem = (
  db: D1Database,
  userId: string,
  itemId: string,
  itemRev: number,
  folderId: string | null,
  newBytes: number,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM vault_items
           WHERE id = ? AND user_id = ? AND rev = ? AND deleted_at IS NULL
         )
         AND (SELECT COALESCE(SUM(LENGTH(data_ct)), 0) FROM vault_items WHERE user_id = ? AND id <> ?) + ? <= ?
         AND (? IS NULL OR EXISTS (
           SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         ))`,
    )
    .bind(
      userId,
      itemId,
      userId,
      itemRev,
      userId,
      itemId,
      newBytes,
      (MAX_ITEM_BYTES * 4) / 3,
      folderId,
      folderId,
      userId,
    );

export const incrementVaultRevIfItemLive = (db: D1Database, userId: string, itemId: string): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM vault_items WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         )`,
    )
    .bind(userId, itemId, userId);

export const incrementVaultRevIfItemDeleted = (db: D1Database, userId: string, itemId: string): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM vault_items WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND data_ct <> '' AND data_iv <> ''
         )`,
    )
    .bind(userId, itemId, userId);

export const incrementVaultRevIfItemUnpurged = (db: D1Database, userId: string, itemId: string): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM vault_items
           WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND data_ct <> ''
         )`,
    )
    .bind(userId, itemId, userId);

export const incrementVaultRevForNewFolder = (db: D1Database, userId: string, folderId: string): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND NOT EXISTS (SELECT 1 FROM folders WHERE id = ?)
         AND (SELECT COUNT(*) FROM folders WHERE user_id = ? AND deleted_at IS NULL) < ?
         AND (SELECT COUNT(*) FROM folders WHERE user_id = ?) < ?`,
    )
    .bind(userId, folderId, userId, MAX_ACTIVE_FOLDERS, userId, MAX_FOLDER_ROWS);

export const incrementVaultRevIfFolderActive = (
  db: D1Database,
  userId: string,
  folderId: string,
  expectedRev: number,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM folders
           WHERE id = ? AND user_id = ? AND rev = ? AND deleted_at IS NULL
         )`,
    )
    .bind(userId, folderId, userId, expectedRev);
