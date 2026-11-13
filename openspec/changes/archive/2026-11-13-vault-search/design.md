# Design

## Context

See `proposal.md`. Vault items are already decrypted into `DecryptedItem` for the list (`app/lib/vault/projection.ts`). Search must not add a server path or move plaintext into URLs, logs, or storage. The existing shadcn Dialog, Input, Button, and Badge primitives are enough; no command-menu dependency is needed.

## Goals / Non-Goals

**Goals:**

- Instant client-only matching across name, username, URLs, notes, and body.
- `Ctrl/Cmd+K` palette with visible trigger, highlight, keyboard navigation, and accessible result count.
- Offline support and a 1000-item performance budget.
- E2E proof that the query never reaches the server.

**Non-Goals:**

- Server-side/FTS search, fuzzy ranking, saved searches, or cross-vault search.
- Search inside trashed items.
- Changing list filters or item payload/API contracts.

## Decisions

### Pure search module with a prebuilt index

Add `vault-list.search.lib.ts` containing:

- `SEARCH_FIELD_ORDER = ['name', 'username', 'url', 'notes', 'body']`
- `buildSearchIndex(items)` producing lowercase field values once per item projection
- `searchItems(index, query, limit)` returning `{ item, field, snippet }[]`
- `splitHighlight(text, query)` returning safe before/match/after segments
- `MAX_SEARCH_RESULTS = 50`

The index is built with `useMemo` when `visible`/all active items change. Query matching lowercases the query once and uses `indexOf`; it returns one result per item using the highest-priority matched field. Snippets are bounded around the match. This is O(items × fields) with no regex and no HTML.

The palette searches all active decrypted items, not the current type/folder/favorite filter. Filters remain an independent list concern.

### Palette owns its open/query state

`VaultSearchDialog` owns `open`, `query`, `activeIndex`, trigger ref, and input ref. It listens for `Ctrl/Cmd+K` globally and renders a "Search vault" trigger with a shortcut hint. This keeps `vault-list.hooks.ts` below its size limit and avoids another feature hook file.

Use a 50ms debounced query. While the input and debounced query differ, render no stale options and ignore selection keys. The pure search benchmark target is under 50ms for 1000 items, keeping the user-visible update within 100ms.

### Result rendering and accessibility

The palette is a shadcn `Dialog` with a labelled search input and a `role="listbox"` result container. Focus stays on the input; ArrowUp/ArrowDown update `aria-activedescendant`, Enter opens the active item, Escape closes the dialog. Focus returns to the trigger on close.

Each result is a `role="option"` row with `aria-selected`. The row shows the item name and a secondary snippet from the matched field, using `<mark>` segments from `splitHighlight` — never `dangerouslySetInnerHTML`. A polite live region announces the total matches and whether the render cap applies.

### No network, URL, or persistence side effects

The palette never calls fetch, never writes `location`/history, and never persists query state. It reads only `DecryptedItem[]` already in memory. Closing clears the query.

### File layout

```text
features/vault-list/
├── components/
│   ├── vault-search-dialog.tsx     # trigger, dialog, keyboard, query state
│   └── vault-search-result.tsx     # option row + highlight
├── vault-list.search.lib.ts        # pure index/search/highlight helpers
└── __test__/vault-list.search.test.ts
```

Integrate the trigger in the vault-list header next to "New item". Add all copy to `app/lib/i18n/en.ts`.

## Risks / Trade-offs

- **Rendering 1000 rows** → cap visible results at 50 and show total count; matching still scans all items.
- **Debounce vs 100ms budget** → 50ms debounce plus sub-50ms search; benchmark enforces the total on a 1000-item fixture.
- **Active descendant complexity** → keep focus on input and expose `aria-activedescendant`; axe + keyboard E2E validate it.
- **Search all vs filtered** → search all active items for predictability; filters remain visible but do not constrain palette search.
- **Case-insensitive Unicode** → lowercase with `toLocaleLowerCase()`; substring matching only, no locale collation promises.

## Migration Plan

- Ship behind the existing vault-list feature; no schema, API, or cache migration.
- Rollback is deleting the palette trigger/hook; no data changes.

## Open Questions

None.
