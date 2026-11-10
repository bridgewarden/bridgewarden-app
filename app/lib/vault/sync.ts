import { z } from 'zod';

import { applyVaultDelta, getSyncState, setSyncState } from './cache';
import { readKeyMaterial } from './key-material';
import { getVaultKey } from './key-store';
import { getVaultEpoch, openVaultDb, VaultDbUnavailableError } from './local-db';
import type { CachedFolder, CachedItem } from './types';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'degraded' | 'error';
type Listener = (status: SyncStatus) => void;

let status: SyncStatus = 'idle';
let activeSync: Promise<SyncStatus> | null = null;
const listeners = new Set<Listener>();
const MAX_PAGES = 1000;

const itemSchema = z.strictObject({
  id: z.string().min(1).max(64),
  type: z.enum(['login', 'note']),
  folderId: z.string().min(1).max(64).nullable(),
  favorite: z.boolean(),
  dataCt: z.string().max(90_000),
  dataIv: z.string().max(64),
  dataVersion: z.number().int().min(1),
  rev: z.number().int().min(0),
  deletedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

const folderSchema = z.strictObject({
  id: z.string().min(1).max(64),
  nameCt: z.string().max(90_000),
  nameIv: z.string().max(64),
  dataVersion: z.number().int().min(1),
  rev: z.number().int().min(0),
  deletedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

const pageSchema = z.strictObject({
  ok: z.literal(true),
  serverRev: z.number().int().min(0),
  items: z.array(itemSchema).max(500),
  folders: z.array(folderSchema).max(500),
  nextCursor: z.string().min(1).max(256).optional(),
});

type VaultDeltaResponse = {
  serverRev: number;
  items: CachedItem[];
  folders: CachedFolder[];
  nextCursor?: string;
};

const setStatus = (next: SyncStatus) => {
  status = next;
  for (const listener of listeners) listener(next);
};

export const getSyncStatus = (): SyncStatus => status;

export const subscribeSyncStatus = (listener: Listener): (() => void) => {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
};

export const resetSyncStatus = (): void => setStatus('idle');

const runSync = async (): Promise<SyncStatus> => {
  if ((globalThis.navigator as Navigator | undefined)?.onLine === false) {
    setStatus('offline');
    return status;
  }

  try {
    if (!getVaultKey() || !(await readKeyMaterial())) {
      setStatus('idle');
      return status;
    }
    await openVaultDb();
  } catch (error) {
    setStatus(error instanceof VaultDbUnavailableError ? 'degraded' : 'error');
    return status;
  }

  const epoch = getVaultEpoch();
  setStatus('syncing');

  try {
    const state = await getSyncState();
    let cursor = state.cursor;
    let pages = 0;

    for (;;) {
      pages += 1;
      if (pages > MAX_PAGES) throw new Error('vault sync page limit');

      const query = new URLSearchParams({ since: String(state.serverRev) });
      if (cursor) query.set('cursor', cursor);

      const response = await fetch(`/api/vault?${query.toString()}`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error('vault sync failed');

      const parsed = pageSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error('vault sync response invalid');
      const page = parsed.data as VaultDeltaResponse;
      if (getVaultEpoch() !== epoch) {
        setStatus('idle');
        return status;
      }

      await applyVaultDelta(page.items, page.folders);

      if (!page.nextCursor) {
        if (getVaultEpoch() === epoch) await setSyncState({ serverRev: page.serverRev, cursor: null });
        break;
      }

      cursor = page.nextCursor;
      if (getVaultEpoch() === epoch) await setSyncState({ serverRev: state.serverRev, cursor });
    }

    setStatus('idle');
  } catch {
    setStatus('error');
  }

  return status;
};

export const syncVault = (): Promise<SyncStatus> => {
  activeSync ??= runSync().finally(() => {
    activeSync = null;
  });

  return activeSync;
};
