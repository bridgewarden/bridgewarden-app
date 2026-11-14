import { recordAuditEventSafe, recordAuditEventsSafe } from '../../lib/.server/audit';
import { auditFingerprints } from '../../lib/.server/request-fingerprint';
import { createVaultQueries } from './queries';
import type { VaultItemRow } from './queries/items';
import { toItemResponse, type VaultItemResponse } from './transport';

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const PURGE_BATCH_SIZE = 1000;
export const PURGE_MAX_BATCHES = 100;
export const PURGE_AUDIT_BATCH_SIZE = 100;

export type TrashResult =
  { status: 'ok'; item: VaultItemResponse } | { status: 'not-found' } | { status: 'server-error' };

export type PurgeResult =
  { status: 'ok'; item: VaultItemResponse; purged: boolean } | { status: 'not-found' } | { status: 'server-error' };

type Transition = (
  vault: ReturnType<typeof createVaultQueries>,
  userId: string,
  itemId: string,
  now: number,
) => Promise<D1Result[]>;

const transition = async (env: Env, userId: string, itemId: string, run: Transition): Promise<TrashResult> => {
  const vault = createVaultQueries(env);
  const now = Date.now();

  try {
    const row = (await run(vault, userId, itemId, now))[1]?.results?.[0] as VaultItemRow | undefined;
    if (row) return { status: 'ok', item: toItemResponse(row) };
  } catch {
    return { status: 'server-error' };
  }

  const current = await vault.findOwnedItem(userId, itemId);
  return current ? { status: 'ok', item: toItemResponse(current) } : { status: 'not-found' };
};

export const trashVaultItem = (env: Env, userId: string, itemId: string): Promise<TrashResult> =>
  transition(env, userId, itemId, (vault, owner, id, now) => vault.batchTrashItem(owner, id, now));

export const restoreVaultItem = async (env: Env, userId: string, itemId: string): Promise<TrashResult> => {
  const result = await transition(env, userId, itemId, (vault, owner, id, now) =>
    vault.batchRestoreItem(owner, id, now),
  );
  if (result.status === 'ok' && (result.item.dataCt === '' || result.item.dataIv === '')) {
    return { status: 'not-found' };
  }
  return result;
};

export const purgeVaultItem = async (
  env: Env,
  userId: string,
  itemId: string,
  request?: Request,
): Promise<PurgeResult> => {
  const vault = createVaultQueries(env);

  try {
    const results = await vault.purgeItem(userId, itemId);
    const row = results[1]?.results?.[0] as VaultItemRow | undefined;
    if (row) {
      if (request) {
        await recordAuditEventSafe(env, {
          type: 'item.purged',
          userId,
          createdAt: Date.now(),
          ...(await auditFingerprints(env, request)),
        });
      }
      return { status: 'ok', item: toItemResponse(row), purged: true };
    }
  } catch {
    return { status: 'server-error' };
  }

  const current = await vault.findOwnedItem(userId, itemId);
  if (!current || current.deleted_at === null) return { status: 'not-found' };
  return { status: 'ok', item: toItemResponse(current), purged: false };
};

export const purgeExpiredItems = async (env: Env, now = Date.now()): Promise<{ count: number; userIds: string[] }> => {
  const vault = createVaultQueries(env);
  const cutoff = now - TRASH_RETENTION_MS;
  let total = 0;
  const affectedUsers = new Set<string>();

  for (let batch = 0; batch < PURGE_MAX_BATCHES; batch += 1) {
    const items = await vault.deleteExpiredItemsBatch(cutoff, PURGE_BATCH_SIZE);
    const folders = await vault.deleteExpiredFoldersBatch(cutoff, PURGE_BATCH_SIZE);
    total += items.changes + folders.changes;
    for (const userId of [...items.userIds, ...folders.userIds]) affectedUsers.add(userId);
    if (items.changes < PURGE_BATCH_SIZE && folders.changes < PURGE_BATCH_SIZE) break;
  }

  return { count: total, userIds: [...affectedUsers] };
};

export const runScheduledPurge = async (env: Env, now = Date.now()): Promise<number> => {
  const { count, userIds } = await purgeExpiredItems(env, now);
  const createdAt = Date.now();
  for (let index = 0; index < userIds.length; index += PURGE_AUDIT_BATCH_SIZE) {
    const events = userIds
      .slice(index, index + PURGE_AUDIT_BATCH_SIZE)
      .map((userId) => ({ type: 'vault.purge', userId, createdAt }));
    await recordAuditEventsSafe(env, events);
  }
  console.log('vault.purge', count);
  return count;
};
