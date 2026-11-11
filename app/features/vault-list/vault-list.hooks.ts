import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { toast } from 'sonner';

import { ENVELOPE_VERSION } from '~/lib/crypto/contract';
import { sealItem } from '~/lib/crypto/envelope';
import { t } from '~/lib/i18n/en';
import { parseItemPayload } from '~/lib/vault/item-payload';
import { getVaultKey } from '~/lib/vault/key-store';
import { enqueueOutbox, flushOutbox, subscribeOutboxEvents } from '~/lib/vault/outbox';
import { readVaultProjection, type DecryptedFolder, type DecryptedItem } from '~/lib/vault/projection';
import { getSyncStatus, subscribeSyncStatus, syncVault } from '~/lib/vault/sync';
import type { CachedItem } from '~/lib/vault/types';

import { DEFAULT_FILTERS, filterAndSortItems, type VaultListFilters } from './vault-list.lib';

export type VaultListStatus = 'loading' | 'ready' | 'offline' | 'degraded' | 'error';

export type CreateItemInput = {
  name: string;
  type: 'login' | 'note';
  folderId: string | null;
  favorite: boolean;
};

export const useVaultList = () => {
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [projectionError, setProjectionError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<VaultListFilters>(DEFAULT_FILTERS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const syncStatus = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, () => 'idle' as const);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setRefreshing(true);
    try {
      await syncVault();
      const projection = await readVaultProjection();
      if (current !== generation.current) return;
      setItems(projection.items);
      setFolders(projection.folders);
      setSkipped(projection.skipped);
      setFilters((filters) =>
        filters.folderId !== 'all' &&
        filters.folderId !== 'none' &&
        !projection.folders.some((folder) => folder.id === filters.folderId)
          ? { ...filters, folderId: 'all' }
          : filters,
      );
      setProjectionError(false);
      setLoaded(true);
    } catch {
      if (current === generation.current) {
        setProjectionError(true);
        setLoaded(true);
      }
    } finally {
      if (current === generation.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeOutboxEvents((event) => {
      if (event.type === 'error') {
        toast.error(t('vault.outboxError'));
        return;
      }
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => void load(), 100);
    });
    return () => {
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [load]);

  const visibleItems = useMemo(() => filterAndSortItems(items, filters), [filters, items]);
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, visibleItems.length - 1));

  const updateFilters = useCallback((patch: Partial<VaultListFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setActiveIndex(0);
  }, []);

  const createItem = useCallback(
    async (input: CreateItemInput) => {
      const key = getVaultKey();
      if (!key) throw new Error('vault is locked');

      try {
        const payload = parseItemPayload(
          input.type,
          input.type === 'login' ? { type: 'login', name: input.name } : { type: 'note', name: input.name, body: '' },
        );
        if (!payload) throw new Error('invalid item payload');
        const sealed = await sealItem(payload, key);
        const id = crypto.randomUUID();
        const now = Date.now();
        const optimistic: CachedItem = {
          id,
          type: input.type,
          folderId: input.folderId,
          favorite: input.favorite,
          dataCt: sealed.ct,
          dataIv: sealed.iv,
          dataVersion: ENVELOPE_VERSION,
          rev: 0,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        await enqueueOutbox({
          kind: 'item.create',
          id,
          idempotencyId: id,
          entity: 'item',
          optimistic,
          previous: null,
          payload: {
            type: input.type,
            folderId: input.folderId,
            favorite: input.favorite,
            dataCt: sealed.ct,
            dataIv: sealed.iv,
            dataVersion: ENVELOPE_VERSION,
          },
          queuedAt: now,
        });
        await load();
        void flushOutbox();
      } finally {
        key.fill(0);
      }
    },
    [load],
  );

  const detailItem = detailId ? (items.find((item) => item.id === detailId) ?? null) : null;
  const status: VaultListStatus = !loaded
    ? 'loading'
    : projectionError || syncStatus === 'error'
      ? 'error'
      : syncStatus === 'offline'
        ? 'offline'
        : syncStatus === 'degraded'
          ? 'degraded'
          : 'ready';
  const closeDetail = useCallback(() => setDetailId(null), []);

  return {
    items,
    folders,
    skipped,
    status,
    refreshing,
    filters,
    updateFilters,
    visibleItems,
    activeIndex: safeActiveIndex,
    setActiveIndex,
    detailItem,
    openDetail: setDetailId,
    closeDetail,
    createItem,
    retry: load,
  };
};
