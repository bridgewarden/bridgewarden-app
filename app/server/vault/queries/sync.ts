import type { VaultCursor } from '../cursor';
import type { VaultFolderRow } from './folders';
import type { VaultItemRow } from './items';

export const VAULT_PAGE_SIZE = 500;

export type VaultItemDeltaRow = VaultItemRow & { kind: 'item' };
export type VaultFolderDeltaRow = VaultFolderRow & { kind: 'folder' };
export type VaultDeltaRow = VaultItemDeltaRow | VaultFolderDeltaRow;

export const listVaultDelta = async (
  db: D1Database,
  userId: string,
  since: number,
  cursor: VaultCursor | null,
  limit = VAULT_PAGE_SIZE,
): Promise<VaultDeltaRow[]> => {
  const cursorClause = cursor ? 'AND (rev > ? OR (rev = ? AND id > ?))' : '';
  const baseClause = cursor ? '' : 'AND rev > ?';
  const cursorBinds = cursor ? [cursor.rev, cursor.rev, cursor.id] : [];
  const sinceBinds = cursor ? [] : [since];
  const { results } = await db
    .prepare(
      `SELECT 'item' AS kind, id, type, folder_id, favorite, data_ct, data_iv,
              NULL AS name_ct, NULL AS name_iv, data_version, rev, deleted_at, created_at, updated_at
       FROM vault_items
       WHERE user_id = ? ${baseClause} ${cursorClause}
       UNION ALL
       SELECT 'folder' AS kind, id, NULL AS type, NULL AS folder_id, NULL AS favorite,
              NULL AS data_ct, NULL AS data_iv, name_ct, name_iv, data_version, rev,
              NULL AS deleted_at, created_at, updated_at
       FROM folders
       WHERE user_id = ? ${baseClause} ${cursorClause}
       ORDER BY rev, id
       LIMIT ?`,
    )
    .bind(userId, ...sinceBinds, ...cursorBinds, userId, ...sinceBinds, ...cursorBinds, limit + 1)
    .all<VaultItemDeltaRow | VaultFolderDeltaRow>();

  return (results ?? []) as VaultDeltaRow[];
};
