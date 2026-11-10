export type VaultItemInput = {
  type: 'login' | 'note';
  folderId: string | null;
  favorite: boolean;
  dataCt: string;
  dataIv: string;
  dataVersion: number;
};

export type VaultFolderInput = {
  nameCt: string;
  nameIv: string;
  dataVersion: number;
};

export const MAX_FOLDER_CIPHERTEXT_BYTES = 4 * 1024;
export const MAX_ACTIVE_FOLDERS = 500;
export const MAX_FOLDER_ROWS = 2000;
