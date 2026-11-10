import { standardToBase64Url } from '../../lib/base64-url';

const transportValue = (value: string): string => (value === '' ? '' : standardToBase64Url(value));
import type { VaultFolderRow } from './queries/folders';
import type { VaultItemRow } from './queries/items';
import type { VaultDeltaRow } from './queries/sync';

export type VaultItemResponse = {
  id: string;
  type: 'login' | 'note';
  folderId: string | null;
  favorite: boolean;
  dataCt: string;
  dataIv: string;
  dataVersion: number;
  rev: number;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type VaultFolderResponse = {
  id: string;
  nameCt: string;
  nameIv: string;
  dataVersion: number;
  rev: number;
  createdAt: number;
  updatedAt: number;
};

export const toItemResponse = (row: VaultItemRow): VaultItemResponse => ({
  id: row.id,
  type: row.type,
  folderId: row.folder_id,
  favorite: row.favorite === 1,
  dataCt: transportValue(row.data_ct),
  dataIv: transportValue(row.data_iv),
  dataVersion: row.data_version,
  rev: row.rev,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toFolderResponse = (row: VaultFolderRow): VaultFolderResponse => ({
  id: row.id,
  nameCt: standardToBase64Url(row.name_ct),
  nameIv: standardToBase64Url(row.name_iv),
  dataVersion: row.data_version,
  rev: row.rev,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const splitDelta = (rows: VaultDeltaRow[]) => {
  const items: VaultItemResponse[] = [];
  const folders: VaultFolderResponse[] = [];

  for (const row of rows) {
    if (row.kind === 'item') items.push(toItemResponse(row));
    else folders.push(toFolderResponse(row));
  }

  return { items, folders };
};
