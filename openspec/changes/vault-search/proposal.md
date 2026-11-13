## Why

TASK-19's release E2E acceptance requires search, but the MVP still says `Ctrl/Cmd+K` "arrives with client-side search". The vault list can filter by type/folder/favorite but cannot find an item by its decrypted name, username, URL, or notes. Because the server never sees plaintext, search must run entirely in the browser.

## What Changes

- Add a client-only vault search palette opened by `Ctrl/Cmd+K` or a visible "Search vault" trigger.
- Match case-insensitive substrings across decrypted item name, username, URLs, notes, and secure-note body.
- Rank name matches before username, URL, notes/body; return one best match per item with a highlighted snippet.
- Debounce input briefly and cap rendered results while announcing the total match count.
- Support keyboard navigation, Enter to open the item detail, Escape to close, and focus restore.
- Never send the query to the server, logs, URLs, or history; search works offline over the in-memory projection.
- Add unit benchmarks for 1000 items and E2E coverage for offline search and zero network requests.

## Capabilities

### New Capabilities

- `vault-search`: client-side search over decrypted vault items, palette interaction, highlighting, privacy, accessibility, and performance.

### Modified Capabilities

None.

## Impact

- `app/features/vault-list/` — search lib, dialog/result components, list integration, i18n keys.
- Unit tests and `e2e/vault-search.spec.ts`; Playwright project entry.
- No server, API, database, or crypto contract changes.
- No new runtime dependency; existing shadcn Dialog/Input/Button primitives are sufficient.
