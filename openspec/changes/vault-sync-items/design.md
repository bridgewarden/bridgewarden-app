# Design

## Context

See `proposal.md` - Why. The vault tables already exist (`vault_items`, `folders`) with per-user indexes and `rev` columns, and `users.vault_rev` is the server watermark. The app has typed query factories, `requireUserApi`, `readMutationJson` with a 256KB cap, and a rate-limited auth boundary. This change adds the first vault server domain; folder writes, trash, and cron are deferred.

## Goals / Non-Goals

**Goals:**

- One stable delta contract that the future client cache can resume from a cursor.
- Atomic item creation with a globally increasing revision.
- Optimistic item updates with a 409 that carries the current row.
- Uniform 404 for foreign ids and strict session-derived authorization.
- Validation that fails closed without logging ciphertext or tokens.

**Non-Goals:**

- Vault decryption, plaintext search, or item rendering.
- Folder create/rename/delete; folders appear in sync only.
- Trash, restore, purge, and the daily cron.
- Client IndexedDB cache, outbox, or optimistic UI.

## Decisions

### Vault domain and query placement

Create `app/server/vault/` for cross-feature domain logic and `app/server/vault/queries/` for raw SQL. Routes stay transport-only and call one use case each. Item and folder row types and column aliases live in the query modules; use cases never call `prepare()` or `bind()` directly.

Structure:

```text
app/server/vault/
  cursor.ts            opaque cursor encode/decode
  sync.ts              delta use case
  items.ts             create and update use cases
  input.ts             strict request schemas
  transport.ts         row -> API response mapping
  queries/index.ts     vault query factory
  queries/items.ts
  queries/folders.ts
  queries/rev.ts
  queries/sync.ts
```

### Delta query uses one ordered union with a cursor

`GET /api/vault` reads a single ordered stream so the page cap and cursor are unambiguous:

```sql
SELECT 'item' AS kind, id, ... FROM vault_items
WHERE user_id = ? AND rev > ? AND (rev > ? OR (rev = ? AND id > ?))
UNION ALL
SELECT 'folder' AS kind, id, ... FROM folders
WHERE user_id = ? AND rev > ? AND (rev > ? OR (rev = ? AND id > ?))
ORDER BY rev, id
LIMIT 501
```

The cursor is opaque base64url of `rev:id`. Rows are ordered by `rev, id`, which is stable because ids are unique UUIDs. Return the first 500 rows and a `nextCursor` from the 500th; a 501st row proves there is another page. `serverRev` is the global `users.vault_rev` when the page is complete. When the page is truncated, `serverRev` is the revision of the last returned row; the client resumes with that value as `since` plus the opaque cursor, and the cursor branch applies only the cursor condition.

Why not separate item/folder cursors: the API contract has one cursor and one page budget. Why not offset pagination: revisions change between pages and offsets would duplicate or skip rows.

### Revision allocation and atomic creation

Create uses one D1 batch:

```text
UPDATE users SET vault_rev = vault_rev + 1, updated_at = ? WHERE id = ?
INSERT INTO vault_items (..., rev, ...)
SELECT ..., vault_rev, ... FROM users WHERE id = ?
```

The insert reads the revision from the same user row after the update, so the client and server agree on the new value. D1 executes a batch as one transaction; if the insert fails (for example a foreign-key failure after a folder race), both statements roll back and no revision is consumed. The folder is pre-checked for ownership; the FK is the final race guard. A query test injects a failing insert and asserts `vault_rev` is unchanged.

Update uses the same two-statement batch with a guarded item update:

```sql
UPDATE vault_items SET ..., rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
WHERE id = ? AND user_id = ? AND rev = ?
```

The revision increment is conditional on the same item id, user, current rev, and a non-tombstoned row, so a 404 or stale 409 consumes no revision. The route returns 409 with the current row and does not retry. Unconditional gaps are not used.

### Strict full-body update

`PATCH` accepts a full encrypted item shape plus the current `rev`: `type`, `folderId`, `favorite`, `dataCt`, `dataIv`, `dataVersion`, and `rev`. Partial field updates would force dynamic SQL and ambiguous validation; the client always has the full row from sync or cache, so a full replacement keeps the contract simple. `deletedAt` is not accepted here because trash is a separate change.

### Authorization and error shape

`requireUserApi` supplies the user id for every handler. Use cases call the vault query factory's owned-item and owned-folder lookups and return a 404 result when they are null; no handler returns 403 for another user's id. The create body is a strict object with no `user_id`; an unknown field is a 400.

### Validation at the boundary

Authenticated vault mutations are IP rate-limited before body parsing, then reuse `readMutationJson` for Origin and body-size enforcement, then validate with strict Zod schemas. Ciphertext and IV fields are base64url; item ciphertext is variable up to 64KB and the IV is exactly 12 bytes. `dataVersion >= 1`; `type` is `login|note`; `favorite` is boolean; folder id is optional. Convert to standard base64 for D1 storage and back to base64url for responses. Validation failures return 400 and log only an error code, never the body.

## Risks / Trade-offs

- **D1 batch atomicity assumption** -> verify with a query test that a failing second statement leaves `vault_rev` unchanged; if D1 does not roll back, switch to a compensating design before shipping.
- **No revision gap on rejected updates** -> the conditional batch proves it in a test; create rollback is separately tested.
- **Union query cost** -> both tables have `(user_id, rev)` indexes (folders gain one in migration `0011`); the 501-row cap bounds work.
- **Folder rows included before folder writes exist** -> the client receives an empty partition initially; no contract change later.
- **Cursor tampering** -> reject malformed cursors with 400; the cursor is not a security boundary because every query is user-scoped.
- **Full PATCH payload** -> larger requests than a sparse patch, still bounded by 256KB and 64KB ciphertext.

## Migration Plan

1. Add server domain, query modules, and routes in one application deploy; no D1 migration.
2. Verify sync with `since=0` and a second call with the returned `serverRev`.
3. Verify cross-user 404s and stale-rev 409s before wiring the client cache.
4. Roll back by reverting the route registration and server domain; no data changes.

## Open Questions

None.
