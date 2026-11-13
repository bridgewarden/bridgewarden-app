import type { DecryptedItem } from '~/lib/vault/projection';

export type SearchField = 'name' | 'username' | 'url' | 'notes' | 'body';

export type SearchResult = {
  item: DecryptedItem;
  field: SearchField;
  before: string;
  match: string;
  after: string;
};

type SearchText = { value: string; lower: string };

export type SearchIndexEntry = {
  item: DecryptedItem;
  name: SearchText;
  username: SearchText;
  urls: SearchText[];
  notes: SearchText;
  body: SearchText;
};

export const SEARCH_DEBOUNCE_MS = 50;
export const MAX_SEARCH_RESULTS = 50;
const SEARCH_FIELD_ORDER: SearchField[] = ['name', 'username', 'url', 'notes', 'body'];

const fold = (value: string): string => value.normalize('NFC').toLowerCase();

const text = (value: string): SearchText => {
  const display = value.normalize('NFC');
  return { value: display, lower: fold(display) };
};

export const buildSearchIndex = (items: DecryptedItem[]): SearchIndexEntry[] =>
  items.map((item) => ({
    item,
    name: text(item.name),
    username: text(item.username ?? ''),
    urls: item.urls.map((url) => text(url)),
    notes: text(item.notes ?? ''),
    body: text(item.body ?? ''),
  }));

const snippet = (
  value: string,
  matchIndex: number,
  matchLength: number,
): Pick<SearchResult, 'before' | 'match' | 'after'> => {
  const start = Math.max(0, matchIndex - 28);
  const end = Math.min(value.length, matchIndex + matchLength + 48);
  const before = `${start > 0 ? '…' : ''}${value.slice(start, matchIndex)}`;
  const match = value.slice(matchIndex, matchIndex + matchLength);
  const after = `${value.slice(matchIndex + matchLength, end)}${end < value.length ? '…' : ''}`;
  return { before, match, after };
};

const matchFor = (
  entry: SearchIndexEntry,
  query: string,
): Pick<SearchResult, 'field' | 'before' | 'match' | 'after'> | null => {
  if (entry.name.lower.includes(query)) {
    return { field: 'name', ...snippet(entry.name.value, entry.name.lower.indexOf(query), query.length) };
  }
  if (entry.username.lower.includes(query)) {
    return {
      field: 'username',
      ...snippet(entry.username.value, entry.username.lower.indexOf(query), query.length),
    };
  }
  const url = entry.urls.find((candidate) => candidate.lower.includes(query));
  if (url) return { field: 'url', ...snippet(url.value, url.lower.indexOf(query), query.length) };
  if (entry.notes.lower.includes(query)) {
    return { field: 'notes', ...snippet(entry.notes.value, entry.notes.lower.indexOf(query), query.length) };
  }
  if (entry.body.lower.includes(query)) {
    return { field: 'body', ...snippet(entry.body.value, entry.body.lower.indexOf(query), query.length) };
  }
  return null;
};

export const searchItems = (
  index: SearchIndexEntry[],
  rawQuery: string,
  limit = MAX_SEARCH_RESULTS,
): { results: SearchResult[]; total: number } => {
  const query = fold(rawQuery.trim());
  if (!query) return { results: [], total: 0 };

  const matches: SearchResult[] = [];
  for (const entry of index) {
    const match = matchFor(entry, query);
    if (match) matches.push({ item: entry.item, ...match });
  }

  matches.sort(
    (left, right) =>
      SEARCH_FIELD_ORDER.indexOf(left.field) - SEARCH_FIELD_ORDER.indexOf(right.field) ||
      left.item.name.localeCompare(right.item.name, undefined, { sensitivity: 'base' }),
  );

  return { results: matches.slice(0, limit), total: matches.length };
};
