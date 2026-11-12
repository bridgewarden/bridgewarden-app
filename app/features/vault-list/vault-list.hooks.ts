import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { toast } from 'sonner';

import { t } from '~/lib/i18n/en';
import { subscribeOutboxEvents } from '~/lib/vault/outbox';
import { readVaultProjection, type DecryptedFolder, type DecryptedItem } from '~/lib/vault/projection';
import { getSyncStatus, subscribeSyncStatus, syncVault } from '~/lib/vault/sync';

import { DEFAULT_FILTERS, filterAndSortItems, type VaultListFilters } from './vault-list.lib';

type VaultListStatus = 'loading' | 'ready' | 'offline' | 'degraded' | 'error';

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
    retry: load,
  };
};

type VaultListInteractionInput = {
  activeIndex: number;
  detailItem: DecryptedItem | null;
  visibleItems: DecryptedItem[];
  setActiveIndex: (index: number) => void;
  openDetail: (id: string) => void;
};

const isFormTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
};

const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  Boolean(target.closest('button, a, [role="button"], [role="checkbox"], [role="combobox"]'));

const row = (id: string) => document.querySelector<HTMLButtonElement>(`[data-vault-item="${CSS.escape(id)}"]`);

export const useVaultListInteraction = ({
  activeIndex,
  detailItem,
  visibleItems,
  setActiveIndex,
  openDetail,
}: VaultListInteractionInput) => {
  const lastScrolled = useRef(-1);
  const hadDetail = useRef(false);

  useEffect(() => {
    if (hadDetail.current && !detailItem) row(visibleItems[activeIndex]?.id ?? '')?.focus();
    hadDetail.current = Boolean(detailItem);
  }, [activeIndex, detailItem, visibleItems]);

  useEffect(() => {
    if (detailItem || lastScrolled.current === activeIndex) return;
    const active = visibleItems[activeIndex];
    if (!active) return;
    lastScrolled.current = activeIndex;
    row(active.id)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, detailItem, visibleItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (detailItem || isFormTarget(event.target) || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[role="combobox"], [role="listbox"], [role="option"]'))
        return;
      if (event.key === 'Enter' && isInteractiveTarget(target)) return;
      const count = visibleItems.length;
      if (count === 0) return;

      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        const next = Math.min(activeIndex + 1, count - 1);
        setActiveIndex(next);
        const nextItem = visibleItems[next];
        if (nextItem) requestAnimationFrame(() => row(nextItem.id)?.focus());
      } else if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = Math.max(activeIndex - 1, 0);
        setActiveIndex(next);
        const nextItem = visibleItems[next];
        if (nextItem) requestAnimationFrame(() => row(nextItem.id)?.focus());
      } else if (event.key === 'Enter') {
        const active = visibleItems[activeIndex];
        if (active) {
          event.preventDefault();
          openDetail(active.id);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, detailItem, openDetail, setActiveIndex, visibleItems]);
};
