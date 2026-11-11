import { describe, expect, it } from 'vitest';

import type { DecryptedItem } from '~/lib/vault/projection';

import { DEFAULT_FILTERS, filterAndSortItems } from '../vault-list.lib';

const item = (id: number, overrides: Partial<DecryptedItem> = {}): DecryptedItem => ({
  id: String(id),
  type: 'login',
  name: `Item ${id}`,
  username: null,
  urls: [],
  notes: null,
  body: null,
  folderId: null,
  folderName: null,
  favorite: false,
  rev: id,
  createdAt: id,
  updatedAt: id,
  ...overrides,
});

describe('vault list projection helpers', () => {
  it('combines filters and sorts by name', () => {
    const items = [
      item(1, { name: 'Zulu', type: 'login', folderId: 'a', favorite: true }),
      item(2, { name: 'Alpha', type: 'note', folderId: 'a', favorite: true }),
      item(3, { name: 'Beta', type: 'login', folderId: 'b', favorite: false }),
    ];

    expect(
      filterAndSortItems(items, { type: 'login', folderId: 'a', favorite: true, sort: 'name' }).map((row) => row.name),
    ).toEqual(['Zulu']);
    expect(filterAndSortItems(items, DEFAULT_FILTERS).map((row) => row.name)).toEqual(['Alpha', 'Beta', 'Zulu']);
  });

  it('sorts by updated descending and handles 500 rows', () => {
    const items = Array.from({ length: 500 }, (_, index) => item(index, { updatedAt: index }));
    const sorted = filterAndSortItems(items, { ...DEFAULT_FILTERS, sort: 'updated' });

    expect(sorted).toHaveLength(500);
    expect(sorted[0]?.updatedAt).toBe(499);
    expect(sorted[499]?.updatedAt).toBe(0);
  });
});
