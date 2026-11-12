import { getAllCachedItems } from './cache';
import type { CachedItem } from './types';

const listeners = new Set<() => void>();
let count = 0;

export const isRestorableTombstone = (item: CachedItem): boolean =>
  item.deletedAt !== null && item.dataCt !== '' && item.dataIv !== '';

const notify = () => {
  for (const listener of listeners) listener();
};

export const getTrashCount = (): number => count;

export const subscribeTrashCount = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetTrashCount = (): void => {
  count = 0;
  notify();
};

export const refreshTrashCount = async (): Promise<number> => {
  try {
    const items = await getAllCachedItems();
    count = items.filter(isRestorableTombstone).length;
  } catch {
    count = 0;
  }
  notify();
  return count;
};
