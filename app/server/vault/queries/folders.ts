import { incrementVaultRevForNewFolder, incrementVaultRevIfFolderActive } from './rev';
import type { VaultFolderInput } from '../types';
import { MAX_ACTIVE_FOLDERS, MAX_FOLDER_ROWS } from '../types';

export type VaultFolderRow = {
  id: string;
  name_ct: string;
  name_iv: string;
  data_version: number;
  rev: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

const FOLDER_COLUMNS = 'id, name_ct, name_iv, data_version, rev, deleted_at, created_at, updated_at';

export const findOwnedFolder = (db: D1Database, userId: string, folderId: string): Promise<VaultFolderRow | null> =>
  db
    .prepare(`SELECT ${FOLDER_COLUMNS} FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL`)
    .bind(folderId, userId)
    .first<VaultFolderRow>();

export const findAnyOwnedFolder = (db: D1Database, userId: string, folderId: string): Promise<VaultFolderRow | null> =>
  db
    .prepare(`SELECT ${FOLDER_COLUMNS} FROM folders WHERE id = ? AND user_id = ?`)
    .bind(folderId, userId)
    .first<VaultFolderRow>();

export const listActiveFolders = async (db: D1Database, userId: string, limit: number): Promise<VaultFolderRow[]> => {
  const { results } = await db
    .prepare(
      `SELECT ${FOLDER_COLUMNS} FROM folders
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY rev, id LIMIT ?`,
    )
    .bind(userId, limit)
    .all<VaultFolderRow>();

  return results ?? [];
};

export const insertFolderStatement = (
  db: D1Database,
  id: string,
  userId: string,
  input: VaultFolderInput,
  now: number,
): D1PreparedStatement =>
  db
    .prepare(
      `INSERT OR IGNORE INTO folders (id, user_id, name_ct, name_iv, data_version, rev, deleted_at, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, vault_rev, NULL, ?, ?
       FROM users
       WHERE id = ?
         AND (SELECT COUNT(*) FROM folders WHERE user_id = ? AND deleted_at IS NULL) < ?
         AND (SELECT COUNT(*) FROM folders WHERE user_id = ?) < ?
       RETURNING ${FOLDER_COLUMNS}`,
    )
    .bind(
      id,
      userId,
      input.nameCt,
      input.nameIv,
      input.dataVersion,
      now,
      now,
      userId,
      userId,
      MAX_ACTIVE_FOLDERS,
      userId,
      MAX_FOLDER_ROWS,
    );

export const renameFolderStatement = (
  db: D1Database,
  userId: string,
  folderId: string,
  expectedRev: number,
  input: VaultFolderInput,
  now: number,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE folders
       SET name_ct = ?, name_iv = ?, data_version = ?,
           rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
       WHERE id = ? AND user_id = ? AND rev = ? AND deleted_at IS NULL
       RETURNING ${FOLDER_COLUMNS}`,
    )
    .bind(input.nameCt, input.nameIv, input.dataVersion, userId, now, folderId, userId, expectedRev);

export const deleteFolderStatements = (
  db: D1Database,
  userId: string,
  folderId: string,
  now: number,
): D1PreparedStatement[] => [
  db
    .prepare(
      `UPDATE users SET vault_rev = vault_rev + 1
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         )`,
    )
    .bind(userId, folderId, userId),
  db
    .prepare(
      `UPDATE folders
       SET deleted_at = ?, rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL
       RETURNING ${FOLDER_COLUMNS}`,
    )
    .bind(now, userId, now, folderId, userId),
  db
    .prepare(
      `UPDATE vault_items
       SET folder_id = NULL, rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
       WHERE user_id = ? AND folder_id = ?
         AND EXISTS (
           SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at = ?
         )`,
    )
    .bind(userId, now, userId, folderId, folderId, userId, now),
];

export const batchCreateFolder = (
  db: D1Database,
  id: string,
  userId: string,
  input: VaultFolderInput,
  now: number,
): Promise<D1Result[]> =>
  db.batch([incrementVaultRevForNewFolder(db, userId, id), insertFolderStatement(db, id, userId, input, now)]);

export const batchRenameFolder = (
  db: D1Database,
  userId: string,
  folderId: string,
  expectedRev: number,
  input: VaultFolderInput,
  now: number,
): Promise<D1Result[]> =>
  db.batch([
    incrementVaultRevIfFolderActive(db, userId, folderId, expectedRev),
    renameFolderStatement(db, userId, folderId, expectedRev, input, now),
  ]);

export const batchDeleteFolder = (db: D1Database, userId: string, folderId: string, now: number): Promise<D1Result[]> =>
  db.batch(deleteFolderStatements(db, userId, folderId, now));

export const deleteExpiredFoldersBatch = (db: D1Database, cutoff: number, limit: number): Promise<D1Result> =>
  db
    .prepare(
      `DELETE FROM folders
       WHERE id IN (
         SELECT id FROM folders WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT ?
       )`,
    )
    .bind(cutoff, limit)
    .run();
