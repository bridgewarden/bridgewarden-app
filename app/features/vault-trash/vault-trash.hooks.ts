import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from 'sonner';

import { t } from '~/lib/i18n/en';
import { getCachedItem } from '~/lib/vault/cache';
import { enqueueOutbox, flushOutbox, getOutboxEntries, subscribeOutboxEvents } from '~/lib/vault/outbox';
import { readVaultTrash, type TrashedItem } from '~/lib/vault/projection';
import { syncVault } from '~/lib/vault/sync';
import type { CachedItem } from '~/lib/vault/types';

export type TrashStatus = 'loading' | 'ready' | 'error';

export const useVaultTrash = () => {
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setError(null);
    const sync = await syncVault();
    if (current !== generation.current) return;
    try {
      const trash = await readVaultTrash();
      if (current !== generation.current) return;
      setItems(trash);
      setLoaded(true);
      if (sync === 'error') setError(t('vault.syncError'));
    } catch {
      if (current !== generation.current) return;
      setLoaded(true);
      setError(t('vault.syncError'));
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeOutboxEvents((event) => {
      if (event.type === 'error' || event.type === 'conflict') {
        toast.error(t(event.entry.kind === 'item.purge' ? 'trash.purgeFailed' : 'trash.restoreFailed'));
      }
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => void load(), 100);
    });
    return () => {
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [load]);

  const mutate = useCallback(
    async (
      item: TrashedItem,
      kind: 'item.restore' | 'item.purge',
      setBusy: (id: string | null) => void,
      optimisticFor: (current: CachedItem, now: number) => CachedItem,
    ): Promise<boolean> => {
      const current = await getCachedItem(item.id);
      if (!current) {
        toast.error(t(kind === 'item.purge' ? 'trash.purgeFailed' : 'trash.restoreFailed'));
        void load();
        return false;
      }

      setBusy(item.id);
      try {
        const now = Date.now();
        await enqueueOutbox({
          kind,
          id: item.id,
          idempotencyId: null,
          entity: 'item',
          previous: current,
          optimistic: optimisticFor(current, now),
          payload: {},
          queuedAt: now,
        });
        await flushOutbox();
        await load();
        const pending = (await getOutboxEntries()).some((entry) => entry.id === item.id);
        if (pending) toast.error(t(kind === 'item.purge' ? 'trash.purgeFailed' : 'trash.restoreFailed'));
        return !pending;
      } catch {
        toast.error(t(kind === 'item.purge' ? 'trash.purgeFailed' : 'trash.restoreFailed'));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const restore = useCallback(
    (item: TrashedItem) =>
      mutate(item, 'item.restore', setRestoringId, (current, now) => ({ ...current, deletedAt: null, updatedAt: now })),
    [mutate],
  );

  const purge = useCallback(
    (item: TrashedItem) =>
      mutate(item, 'item.purge', setPurgingId, (current, now) => ({
        ...current,
        dataCt: '',
        dataIv: '',
        updatedAt: now,
      })),
    [mutate],
  );

  return {
    items,
    status: (!loaded ? 'loading' : error ? 'error' : 'ready') as TrashStatus,
    error,
    restoringId,
    purgingId,
    restore,
    purge,
    retry: load,
  };
};
