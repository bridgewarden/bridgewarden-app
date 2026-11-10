export type CachedItem = {
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

export type CachedFolder = {
  id: string;
  nameCt: string;
  nameIv: string;
  dataVersion: number;
  rev: number;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type VaultKeyMaterial = {
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  kdfSalt: string;
  kdfIterations: number;
};

export type StoredKeyMaterial = VaultKeyMaterial & {
  key: 'active';
  email: string;
  storedAt: number;
};

export type SyncState = { key: 'active'; serverRev: number; cursor: string | null };
