import { storedToBase64Url, storedToStandardBase64 } from '../base64-url';
import { readKeyMaterial } from './key-material';
import { getVaultKey } from './key-store';
import { getVaultEpoch, openVaultDb } from './local-db';
import { syncVault } from './sync';
import type { CachedFolder, CachedItem, OutboxEntry } from './types';

export type OutboxEvent =
  | { type: 'conflict'; entry: OutboxEntry }
  | { type: 'error'; entry: OutboxEntry; status: number }
  | { type: 'flushed'; entry: OutboxEntry };

type Listener = (event: OutboxEvent) => void;

const listeners = new Set<Listener>();
let activeFlush: Promise<number> | null = null;
let flushRequested = false;

export const subscribeOutboxEvents = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = (event: OutboxEvent) => {
  for (const listener of listeners) listener(event);
};

const CREATE_KINDS = new Set(['item.create', 'folder.create']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'name',
  'username',
  'password',
  'notes',
  'body',
  'url',
  'urls',
  'customFields',
  'totpSecret',
  'vaultKey',
  'masterKey',
  'recoveryKey',
]);

const hasPlaintextKey = (value: unknown, depth = 0): boolean => {
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((entry) => hasPlaintextKey(entry, depth + 1));
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => FORBIDDEN_PAYLOAD_KEYS.has(key) || hasPlaintextKey(nested, depth + 1),
  );
};

const assertEncryptedEntry = (entry: OutboxEntry): void => {
  const expectedEntity = entry.kind.startsWith('item.') ? 'item' : 'folder';
  if (entry.entity !== expectedEntity) throw new Error('outbox entity does not match operation');
  if (CREATE_KINDS.has(entry.kind) && !UUID_PATTERN.test(entry.id)) {
    throw new Error('outbox create requires a UUID id');
  }
  if (hasPlaintextKey(entry.payload)) throw new Error('outbox payload must be ciphertext-only');
};

export const enqueueOutbox = async (entry: OutboxEntry): Promise<number> => {
  assertEncryptedEntry(entry);
  const db = await openVaultDb();
  const entityStore = entry.entity === 'item' ? 'items' : 'folders';
  const transaction = db.transaction(['outbox', entityStore], 'readwrite');
  const value = { ...entry };
  delete value.seq;
  const seq = await transaction.objectStore('outbox').add(value);
  if (entry.optimistic) {
    if (entry.entity === 'item') await transaction.objectStore('items').put(entry.optimistic as CachedItem);
    else await transaction.objectStore('folders').put(entry.optimistic as CachedFolder);
  }
  await transaction.done;
  return seq as number;
};

export const getOutboxEntries = async (): Promise<OutboxEntry[]> => {
  const db = await openVaultDb();
  return db.getAll('outbox');
};

const rollback = async (entry: OutboxEntry): Promise<void> => {
  const db = await openVaultDb();
  const entityStore = entry.entity === 'item' ? 'items' : 'folders';
  const transaction = db.transaction(['outbox', entityStore], 'readwrite');
  const current =
    entry.entity === 'item'
      ? ((await transaction.objectStore('items').get(entry.id)) as CachedItem | undefined)
      : ((await transaction.objectStore('folders').get(entry.id)) as CachedFolder | undefined);
  const optimisticRev = entry.optimistic?.rev ?? 0;
  if (current && current.rev > optimisticRev) {
    // A newer row already won; do not clobber it.
  } else if (entry.previous) {
    if (entry.entity === 'item') await transaction.objectStore('items').put(entry.previous as CachedItem);
    else await transaction.objectStore('folders').put(entry.previous as CachedFolder);
  } else if (entry.entity === 'item') {
    await transaction.objectStore('items').delete(entry.id);
  } else {
    await transaction.objectStore('folders').delete(entry.id);
  }
  if (entry.seq !== undefined) await transaction.objectStore('outbox').delete(entry.seq);
  await transaction.done;
};

const complete = async (entry: OutboxEntry, body: Record<string, unknown>): Promise<void> => {
  const db = await openVaultDb();
  const entityStore = entry.entity === 'item' ? 'items' : 'folders';
  const transaction = db.transaction(['outbox', entityStore], 'readwrite');
  const rawRow = (body.item ?? body.folder) as CachedItem | CachedFolder | undefined;
  const row =
    rawRow && entry.entity === 'item'
      ? {
          ...rawRow,
          dataCt: storedToStandardBase64((rawRow as CachedItem).dataCt),
          dataIv: storedToStandardBase64((rawRow as CachedItem).dataIv),
        }
      : rawRow && entry.entity === 'folder'
        ? {
            ...rawRow,
            nameCt: storedToStandardBase64((rawRow as CachedFolder).nameCt),
            nameIv: storedToStandardBase64((rawRow as CachedFolder).nameIv),
          }
        : undefined;
  if (row) {
    if (entry.entity === 'item') {
      await transaction.objectStore('items').put(row as CachedItem);
      if (row.id !== entry.id) await transaction.objectStore('items').delete(entry.id);
    } else {
      await transaction.objectStore('folders').put(row as CachedFolder);
      if (row.id !== entry.id) await transaction.objectStore('folders').delete(entry.id);
    }
  }
  if (entry.seq !== undefined) await transaction.objectStore('outbox').delete(entry.seq);
  await transaction.done;
};

const CIPHERTEXT_FIELDS = ['dataCt', 'dataIv', 'nameCt', 'nameIv'] as const;

const transportPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...payload };
  for (const field of CIPHERTEXT_FIELDS) {
    const value = next[field];
    if (typeof value === 'string' && value.length > 0) next[field] = storedToBase64Url(value);
  }
  return next;
};

const requestFor = (entry: OutboxEntry): { path: string; method: string; body?: string } => {
  const encoded = encodeURIComponent(entry.id);
  switch (entry.kind) {
    case 'item.create':
      return {
        path: '/api/vault/items',
        method: 'POST',
        body: JSON.stringify({ ...transportPayload(entry.payload), id: entry.idempotencyId ?? entry.id }),
      };
    case 'item.update':
      return {
        path: `/api/vault/items/${encoded}`,
        method: 'PATCH',
        body: JSON.stringify(transportPayload(entry.payload)),
      };
    case 'item.trash':
      return { path: `/api/vault/items/${encoded}`, method: 'DELETE' };
    case 'item.restore':
      return { path: `/api/vault/items/${encoded}/restore`, method: 'POST', body: '{}' };
    case 'item.purge':
      return { path: `/api/vault/items/${encoded}/purge`, method: 'POST', body: '{"confirm":true}' };
    case 'folder.create':
      return {
        path: '/api/folders',
        method: 'POST',
        body: JSON.stringify({ ...transportPayload(entry.payload), id: entry.idempotencyId ?? entry.id }),
      };
    case 'folder.rename':
      return {
        path: `/api/folders/${encoded}`,
        method: 'PATCH',
        body: JSON.stringify(transportPayload(entry.payload)),
      };
    case 'folder.delete':
      return { path: `/api/folders/${encoded}`, method: 'DELETE' };
    default:
      throw new Error('unknown outbox operation');
  }
};

const runFlush = async (): Promise<number> => {
  if (!getVaultKey() || !(await readKeyMaterial())) return 0;
  const epoch = getVaultEpoch();
  const entries = await getOutboxEntries();
  let processed = 0;

  for (const entry of entries) {
    if (getVaultEpoch() !== epoch) break;

    let request: ReturnType<typeof requestFor>;
    try {
      request = requestFor(entry);
    } catch {
      await rollback(entry);
      emit({ type: 'error', entry, status: 400 });
      processed += 1;
      continue;
    }
    let response: Response;
    try {
      response = await fetch(request.path, {
        method: request.method,
        headers: request.body ? { 'content-type': 'application/json' } : undefined,
        body: request.body,
      });
    } catch {
      break;
    }

    if (getVaultEpoch() !== epoch) break;

    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      await complete(entry, body);
      emit({ type: 'flushed', entry });
      processed += 1;
      continue;
    }

    if (response.status === 409) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      await rollback(entry);
      if (body.error === 'limit') emit({ type: 'error', entry, status: 409 });
      else {
        emit({ type: 'conflict', entry });
        void syncVault();
      }
      processed += 1;
      continue;
    }

    if (response.status === 408 || response.status === 429 || response.status >= 500) break;

    if (response.status >= 400 && response.status < 500) {
      await rollback(entry);
      emit({ type: 'error', entry, status: response.status });
      if (response.status === 404 || response.status === 401) void syncVault();
      processed += 1;
      continue;
    }

    break;
  }

  return processed;
};

export const flushOutbox = (): Promise<number> => {
  if (activeFlush) {
    flushRequested = true;
    return activeFlush;
  }

  activeFlush = (async () => {
    let total = 0;
    do {
      flushRequested = false;
      total += await runFlush();
    } while (flushRequested);
    return total;
  })().finally(() => {
    activeFlush = null;
    flushRequested = false;
  });
  return activeFlush;
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOutbox();
  });
}
