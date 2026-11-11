import type { DecryptedItem } from '~/lib/vault/projection';

export type VaultSort = 'name' | 'updated';
export type VaultTypeFilter = 'all' | 'login' | 'note';

export type VaultListFilters = {
  type: VaultTypeFilter;
  folderId: string | 'all' | 'none';
  favorite: boolean;
  sort: VaultSort;
};

export const DEFAULT_FILTERS: VaultListFilters = {
  type: 'all',
  folderId: 'all',
  favorite: false,
  sort: 'name',
};

export const filterAndSortItems = (items: DecryptedItem[], filters: VaultListFilters): DecryptedItem[] =>
  items
    .filter(
      (item) =>
        (filters.type === 'all' || item.type === filters.type) &&
        (filters.folderId === 'all' ||
          (filters.folderId === 'none' ? item.folderId === null : item.folderId === filters.folderId)) &&
        (!filters.favorite || item.favorite),
    )
    .sort((left, right) =>
      filters.sort === 'name'
        ? left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
        : right.updatedAt - left.updatedAt || left.name.localeCompare(right.name),
    );
