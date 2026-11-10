import type { VaultItemInput } from './types';
import { createVaultQueries } from './queries';
import type { VaultItemRow } from './queries/items';
import { toItemResponse, type VaultItemResponse } from './transport';

export type CreateItemResult =
  { status: 'created'; item: VaultItemResponse } | { status: 'not-found' } | { status: 'server-error' };

export type UpdateItemResult =
  | { status: 'ok'; item: VaultItemResponse }
  | { status: 'conflict'; item: VaultItemResponse }
  | { status: 'not-found' }
  | { status: 'server-error' };

const isForeignKeyError = (error: unknown): boolean =>
  error instanceof Error && /FOREIGN KEY|constraint failed/i.test(error.message);

export const createVaultItem = async (env: Env, userId: string, input: VaultItemInput): Promise<CreateItemResult> => {
  const vault = createVaultQueries(env);
  if (input.folderId && !(await vault.findOwnedFolder(userId, input.folderId))) return { status: 'not-found' };

  const id = crypto.randomUUID();
  const now = Date.now();

  let inserted: VaultItemRow | undefined;
  try {
    const results = await vault.batchCreateItem(id, userId, input, now);
    inserted = results[1]?.results?.[0] as VaultItemRow | undefined;
  } catch (error) {
    return { status: isForeignKeyError(error) ? 'not-found' : 'server-error' };
  }

  const row = inserted ?? (await vault.findOwnedItem(userId, id));
  return row ? { status: 'created', item: toItemResponse(row) } : { status: 'server-error' };
};

export const updateVaultItem = async (
  env: Env,
  userId: string,
  itemId: string,
  input: VaultItemInput & { rev: number },
): Promise<UpdateItemResult> => {
  const vault = createVaultQueries(env);
  if (input.folderId && !(await vault.findOwnedFolder(userId, input.folderId))) return { status: 'not-found' };

  const now = Date.now();
  let changes: number;
  let updated: VaultItemRow | undefined;

  try {
    const results = await vault.batchUpdateItem(userId, itemId, input.rev, input, now);
    changes = results[1]?.meta.changes ?? 0;
    updated = results[1]?.results?.[0] as VaultItemRow | undefined;
  } catch (error) {
    return { status: isForeignKeyError(error) ? 'not-found' : 'server-error' };
  }

  if (changes !== 1) {
    const current = await vault.findOwnedItem(userId, itemId);
    return current ? { status: 'conflict', item: toItemResponse(current) } : { status: 'not-found' };
  }

  const row = updated ?? (await vault.findOwnedItem(userId, itemId));
  return row ? { status: 'ok', item: toItemResponse(row) } : { status: 'server-error' };
};
