import type { VaultItemInput } from '../types';
import { incrementVaultRev, incrementVaultRevIfItem } from './rev';

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
      `INSERT INTO vault_items (
        id, user_id, folder_id, type, favorite, data_ct, data_iv, data_version, rev,
        deleted_at, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, vault_rev, NULL, ?, ?
      FROM users WHERE id = ?
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
    );

export const batchCreateItem = (
  db: D1Database,
  id: string,
  userId: string,
  input: VaultItemInput,
  now: number,
): Promise<D1Result[]> =>
  db.batch([incrementVaultRev(db, userId, now), insertItemStatement(db, id, userId, input, now)]);

export const batchUpdateItem = (
  db: D1Database,
  userId: string,
  itemId: string,
  expectedRev: number,
  input: VaultItemInput,
  now: number,
): Promise<D1Result[]> =>
  db.batch([
    incrementVaultRevIfItem(db, userId, itemId, expectedRev),
    updateItemStatement(db, userId, itemId, expectedRev, input, now),
  ]);
