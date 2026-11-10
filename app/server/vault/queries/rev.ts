export type VaultRevRow = { vault_rev: number };

export const findVaultRev = (db: D1Database, userId: string): Promise<VaultRevRow | null> =>
  db.prepare('SELECT vault_rev FROM users WHERE id = ?').bind(userId).first<VaultRevRow>();

export const incrementVaultRev = (db: D1Database, userId: string, now: number): D1PreparedStatement =>
  db.prepare('UPDATE users SET vault_rev = vault_rev + 1, updated_at = ? WHERE id = ?').bind(now, userId);

export const incrementVaultRevIfItem = (
  db: D1Database,
  userId: string,
  itemId: string,
  itemRev: number,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM vault_items
           WHERE id = ? AND user_id = ? AND rev = ? AND deleted_at IS NULL
         )`,
    )
    .bind(userId, itemId, userId, itemRev);
