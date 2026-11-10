export type VaultFolderRow = {
  id: string;
  name_ct: string;
  name_iv: string;
  data_version: number;
  rev: number;
  created_at: number;
  updated_at: number;
};

export const findOwnedFolder = (db: D1Database, userId: string, folderId: string): Promise<VaultFolderRow | null> =>
  db
    .prepare(
      'SELECT id, name_ct, name_iv, data_version, rev, created_at, updated_at FROM folders WHERE id = ? AND user_id = ?',
    )
    .bind(folderId, userId)
    .first<VaultFolderRow>();
