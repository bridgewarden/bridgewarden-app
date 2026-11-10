export type VaultItemInput = {
  type: 'login' | 'note';
  folderId: string | null;
  favorite: boolean;
  dataCt: string;
  dataIv: string;
  dataVersion: number;
};
