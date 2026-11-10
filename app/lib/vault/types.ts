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

export type OutboxKind =
  | 'item.create'
  | 'item.update'
  | 'item.trash'
  | 'item.restore'
  | 'item.purge'
  | 'folder.create'
  | 'folder.rename'
  | 'folder.delete';

export type OutboxEntry = {
  seq?: number;
  kind: OutboxKind;
  id: string;
  idempotencyId: string | null;
  payload: Record<string, unknown>;
  entity: 'item' | 'folder';
  previous: CachedItem | CachedFolder | null;
  optimistic: CachedItem | CachedFolder | null;
  queuedAt: number;
};

export type UnlockResult =
  { status: 'ok' } | { status: 'invalid' } | { status: 'unavailable' } | { status: 'locked-out' };
