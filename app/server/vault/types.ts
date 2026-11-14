export type VaultItemInput = {
  type: 'login' | 'note';
  folderId: string | null;
  favorite: boolean;
  dataCt: string;
  dataIv: string;
  dataVersion: number;
};

export type VaultCreateFolderInput = VaultFolderInput & { id?: string };

export type VaultFolderInput = {
  nameCt: string;
  nameIv: string;
  dataVersion: number;
};

export const MAX_ACTIVE_ITEMS = 5000;
export const MAX_ITEM_ROWS = 20_000;
export const MAX_ITEM_BYTES = 128 * 1024 * 1024;
export type PurgeBatchResult = { changes: number; userIds: string[] };

export const MAX_FOLDER_CIPHERTEXT_BYTES = 4 * 1024;
export const MAX_ACTIVE_FOLDERS = 500;
export const MAX_FOLDER_ROWS = 2000;

export type VaultCreateItemInput = VaultItemInput & { id?: string };
