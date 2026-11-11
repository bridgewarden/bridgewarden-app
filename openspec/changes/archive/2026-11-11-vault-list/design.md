# Design

## Context

See `proposal.md` - Why. Cache rows are ciphertext (`dataCt`/`dataIv`, `nameCt`/`nameIv`) in standard base64, `openItem` exists, and the outbox accepts create/update payloads. The list route is a placeholder. No plaintext item schema, decrypt selector, create path, or detail view exists.

## Goals / Non-Goals

**Goals:**

- Validate plaintext payloads before display.
- Project cached ciphertext into views in memory.
- List, sort, filter, keyboard navigate, and show read-only detail.
- Create a minimal encrypted login/note through the outbox.
- Keep plaintext out of storage, logs, URLs, and server requests.
- Normalize cached base64 to transport base64url at the outbox boundary.

**Non-Goals:**

- Full editors, update/delete, unsaved-change guard (TASK-40/41).
- Search, debounce, highlight, Ctrl/Cmd+K (TASK-39).
- Folder management UI.
- Clipboard/reveal, generator, TOTP UI.
- Virtualization; 500 DOM rows are acceptable for this slice.

## Decisions

### Payload schemas

`app/lib/vault/item-payload.ts` uses strict Zod schemas:

```text
LoginPayload = {
  type: 'login'; name: 1..200; username?: 0..254; password?: 0..1024;
  urls?: up to 20 strings of 0..2048; notes?: 0..50_000;
  totpSecret?: 0..1024;
  customFields?: up to 50 of {label: 1..100; value: 0..5000; hidden: boolean}
}
NotePayload = { type: 'note'; name: 1..200; body: 0..50_000 }
FolderPayload = { name: 1..200 }
```

The payload carries `type` as an integrity check against the cached row type. `strictObject` makes future payload versions explicit. A mismatch or validation failure is a skipped row, never a thrown list error.

### Projection

`app/lib/vault/projection.ts`:

```text
getVaultKey() -> copy
read all cached items/folders
decrypt folders once, build id -> name map
decrypt items with concurrency 8
validate by row.type
drop tombstones, failed folders, failed items
return { items, folders, skippedCount }
zero the key copy in finally
```

Decrypted views stay in React state only. No plaintext is written to IndexedDB, localStorage, sessionStorage, URLs, or logs. Lock unmounts the list and drops the state.

### List hook and refresh

`useVaultList` owns loading, error, projection, filters, sort, and active row. On mount it calls `syncVault()` (memoized in-flight) and then reloads the projection. It also subscribes to outbox `flushed`/`conflict` events and reloads after a create. Offline reads still render cache data; sync failure shows a non-blocking status.

### Filtering, sorting, and performance

Pure `vault-list.lib.ts` functions filter by type, folder, and favorite, then sort by name (`localeCompare`) or `updatedAt` descending. Rows use stable `id` keys. A 500-row pure projection/sort/filter test guards the expensive path; decryption remains batched.

### Minimal create

The empty-state action opens a Dialog with name, type, folder, and favorite.

1. Validate the name via the payload schema.
2. Copy the vault key and seal the minimal payload (`password`, `username`, URLs, notes omitted).
3. Build an optimistic `CachedItem` with `rev: 0`, `dataVersion: 1`, standard-base64 ciphertext.
4. `enqueueOutbox({ kind: 'item.create', id, idempotencyId: id, optimistic, payload })`.
5. Reload the projection and call `flushOutbox()`; failures leave the queued row visible.

Notes are created with an empty body; login items contain only a name. Full fields are edited in TASK-40/41.

### Outbox transport normalization

Cached ciphertext is standard base64; the API accepts base64url. When building HTTP bodies for `item.create`, `item.update`, `folder.create`, and `folder.rename`, map `dataCt`, `dataIv`, `nameCt`, and `nameIv` through `storedToBase64Url`. The cache/optimistic payload keeps standard base64. This prevents a create from being rejected while leaving local rows consistent.

### Keyboard and detail

The list section handles `keydown` only when the event target is not an input, select, textarea, or contenteditable. `j`/ArrowDown and `k`/ArrowUp move the active index; active rows scroll into view. Enter opens a read-only Dialog containing name, type, folder, favorite, username, URLs, and notes/body. No password or TOTP secret is rendered. `Ctrl/Cmd+K` is intentionally left to the search change.

### Routing and feature structure

`features/vault-list/vault-list.tsx` remains a thin page entry. The public container lives in `components/vault-list-panel.tsx`; dialogs and toolbar are leaf components. The route stays `/app`, and the project adds an `e2e/vault-list.spec.ts` project after auth. No server route changes.

## Risks / Trade-offs

- **500 decrypt operations** -> concurrency 8 avoids an unbounded promise fan-out; a 500-row pure projection test covers sort/filter cost.
- **Corrupt cache** -> skipped count is surfaced quietly; one bad row does not blank the vault.
- **Minimal item is sparse** -> the row shows only the name until TASK-40 adds fields; this is intentional.
- **Outbox create rev 0** -> the optimistic row is replaced by the server row on flush; conflict handling already exists.
- **Folder names unknown for old rows** -> missing/invalid folder payload degrades to no folder label.
- **Filters/sort are session-only** -> persistence was not required by TASK-38; the list starts with defaults on a new visit.
- **No search shortcut yet** -> TASK-38's Ctrl/Cmd+K moves to TASK-39 with the search surface.

## Migration Plan

1. Add schemas, projection, and pure list helpers with tests.
2. Add outbox transport normalization and tests.
3. Add hook, list, filters, dialogs, and i18n.
4. Add E2E create/filter/open/reload/lock/unlock.
5. Run the full gate and visual check at 360px.
6. Roll back by reverting the feature; cache/outbox contracts remain unchanged.

## Open Questions

None.
