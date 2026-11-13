import { describe, expect, it } from 'vitest';

import type { DecryptedItem } from '~/lib/vault/projection';

import { buildSearchIndex, MAX_SEARCH_RESULTS, searchItems } from '../vault-list.search.lib';

const item = (patch: Partial<DecryptedItem> = {}): DecryptedItem => ({
  id: patch.id ?? crypto.randomUUID(),
  type: 'login',
  name: 'GitHub',
  username: 'octocat@example.com',
  urls: ['https://github.com'],
  notes: 'work account',
  body: null,
  folderId: null,
  folderName: null,
  favorite: false,
  rev: 1,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

describe('vault search', () => {
  it('matches name, username, URL, notes, and body case-insensitively', () => {
    const account = item({ name: 'Mail', username: 'Person@Example.com', urls: ['https://mail.example.com'] });
    const note = item({ type: 'note', name: 'Wifi', username: null, urls: [], notes: null, body: 'Garage code' });
    const index = buildSearchIndex([account, note]);

    expect(searchItems(index, 'mail').results[0]?.item.id).toBe(account.id);
    expect(searchItems(index, 'PERSON').results[0]?.item.id).toBe(account.id);
    expect(searchItems(index, 'MAIL.EXAMPLE').results[0]?.field).toBe('url');
    expect(searchItems(index, 'work').results[0]?.item.id).toBe(account.id);
    expect(searchItems(index, 'garage').results[0]?.item.id).toBe(note.id);
  });

  it('uses name as the highest-priority match for an item', () => {
    const account = item({ name: 'Shared name', username: 'shared@example.com' });
    const result = searchItems(buildSearchIndex([account]), 'shared').results[0];

    expect(result?.field).toBe('name');
  });

  it('ranks every match before applying the render cap', () => {
    const notesOnly = Array.from({ length: 50 }, (_, index) =>
      item({ id: `note-${index}`, name: `Note ${index}`, username: null, urls: [], notes: 'shared' }),
    );
    const nameMatch = item({ id: 'name-match', name: 'Shared target', username: null, urls: [], notes: null });
    const result = searchItems(buildSearchIndex([...notesOnly, nameMatch]), 'shared');

    expect(result.results).toHaveLength(MAX_SEARCH_RESULTS);
    expect(result.results[0]?.item.id).toBe('name-match');
    expect(result.total).toBe(51);
  });

  it('returns no results for an empty query', () => {
    expect(searchItems(buildSearchIndex([item()]), '   ')).toEqual({ results: [], total: 0 });
  });

  it('keeps markup-like values as text segments', () => {
    const result = searchItems(buildSearchIndex([item({ name: '<b>secret</b>' })]), 'secret').results[0];

    expect(result).toMatchObject({ before: '<b>', match: 'secret', after: '</b>' });
  });

  it('searches 1000 items within the performance budget', () => {
    const started = performance.now();
    const index = buildSearchIndex(
      Array.from({ length: 1000 }, (_, index) =>
        item({
          id: `item-${index}`,
          name: `Account ${index}`,
          username: `user-${index}@example.com`,
          urls: [`https://example.com/${index}`],
          notes: `note-${index}`,
        }),
      ),
    );
    const result = searchItems(index, 'a');
    const elapsed = performance.now() - started;

    expect(result.total).toBe(1000);
    expect(result.results).toHaveLength(MAX_SEARCH_RESULTS);
    expect(elapsed).toBeLessThan(50);
  });
});
