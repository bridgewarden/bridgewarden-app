import { createVaultQueries } from './queries';
import type { VaultFolderRow } from './queries/folders';
import { toFolderResponse, type VaultFolderResponse } from './transport';
import type { VaultCreateFolderInput, VaultFolderInput } from './types';

const FOLDER_LIMIT = 500;

export type FolderListResult = { status: 'ok'; folders: VaultFolderResponse[] } | { status: 'server-error' };

export type FolderCreateResult =
  | { status: 'created'; folder: VaultFolderResponse }
  | { status: 'existing'; folder: VaultFolderResponse }
  | { status: 'limit' }
  | { status: 'not-found' }
  | { status: 'server-error' };

export type FolderRenameResult =
  | { status: 'ok'; folder: VaultFolderResponse }
  | { status: 'conflict'; folder: VaultFolderResponse }
  | { status: 'not-found' }
  | { status: 'server-error' };

export type FolderDeleteResult =
  { status: 'ok'; folder: VaultFolderResponse } | { status: 'not-found' } | { status: 'server-error' };

const resultRow = (results: D1Result[]): VaultFolderRow | undefined =>
  results[1]?.results?.[0] as VaultFolderRow | undefined;

export const listFolders = async (env: Env, userId: string): Promise<FolderListResult> => {
  const vault = createVaultQueries(env);

  try {
    const rows = await vault.listActiveFolders(userId, FOLDER_LIMIT);
    return { status: 'ok', folders: rows.map(toFolderResponse) };
  } catch {
    return { status: 'server-error' };
  }
};

export const createFolder = async (
  env: Env,
  userId: string,
  input: VaultCreateFolderInput,
): Promise<FolderCreateResult> => {
  const vault = createVaultQueries(env);
  const id = input.id ?? crypto.randomUUID();
  const now = Date.now();

  try {
    const results = await vault.batchCreateFolder(id, userId, input, now);
    const row = resultRow(results);
    if (row) return { status: 'created', folder: toFolderResponse(row) };

    const existing = await vault.findAnyOwnedFolder(userId, id);
    if (existing) {
      return existing.deleted_at === null
        ? { status: 'existing', folder: toFolderResponse(existing) }
        : { status: 'not-found' };
    }
    return results[1]?.meta.changes === 0 ? { status: 'limit' } : { status: 'server-error' };
  } catch {
    return { status: 'server-error' };
  }
};

export const renameFolder = async (
  env: Env,
  userId: string,
  folderId: string,
  input: VaultFolderInput & { rev: number },
): Promise<FolderRenameResult> => {
  const vault = createVaultQueries(env);
  const now = Date.now();

  try {
    const row = resultRow(await vault.batchRenameFolder(userId, folderId, input.rev, input, now));
    if (row) return { status: 'ok', folder: toFolderResponse(row) };
  } catch {
    return { status: 'server-error' };
  }

  try {
    const current = await vault.findOwnedFolder(userId, folderId);
    return current ? { status: 'conflict', folder: toFolderResponse(current) } : { status: 'not-found' };
  } catch {
    return { status: 'server-error' };
  }
};

export const deleteFolder = async (env: Env, userId: string, folderId: string): Promise<FolderDeleteResult> => {
  const vault = createVaultQueries(env);
  const now = Date.now();

  try {
    const row = resultRow(await vault.batchDeleteFolder(userId, folderId, now));
    if (row) return { status: 'ok', folder: toFolderResponse(row) };
  } catch {
    return { status: 'server-error' };
  }

  const current = await vault.findAnyOwnedFolder(userId, folderId);
  if (!current) return { status: 'not-found' };
  return current.deleted_at === null ? { status: 'server-error' } : { status: 'ok', folder: toFolderResponse(current) };
};
