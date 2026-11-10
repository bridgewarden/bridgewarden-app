export type VaultRevRow = { vault_rev: number };

export const findVaultRev = (db: D1Database, userId: string): Promise<VaultRevRow | null> =>
  db.prepare('SELECT vault_rev FROM users WHERE id = ?').bind(userId).first<VaultRevRow>();

export const incrementVaultRev = (db: D1Database, userId: string, now: number): D1PreparedStatement =>
  db.prepare('UPDATE users SET vault_rev = vault_rev + 1, updated_at = ? WHERE id = ?').bind(now, userId);

export const incrementVaultRevForNewItem = (
  db: D1Database,
  userId: string,
  folderId: string | null,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND (? IS NULL OR EXISTS (
           SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         ))`,
    )
    .bind(userId, folderId, folderId, userId);

export const incrementVaultRevIfItem = (
  db: D1Database,
  userId: string,
  itemId: string,
  itemRev: number,
  folderId: string | null,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM vault_items
           WHERE id = ? AND user_id = ? AND rev = ? AND deleted_at IS NULL
         )
         AND (? IS NULL OR EXISTS (
           SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         ))`,
    )
    .bind(userId, itemId, userId, itemRev, folderId, folderId, userId);

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
           SELECT 1 FROM vault_items WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL
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
