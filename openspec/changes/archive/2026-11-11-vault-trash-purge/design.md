# Design

## Context

See `proposal.md` - Why. `vault_items` already has `deleted_at`, the sync delta includes tombstones, and item update rejects tombstoned rows. The vault query factory, conditional rev pattern, transport mapper, and `no-store` route conventions exist from `vault-sync-items`. The Worker currently exports only `fetch`; `wrangler.jsonc` has no cron trigger.

## Goals / Non-Goals

**Goals:**

- Complete the item lifecycle without changing the sync contract.
- Keep delete and restore idempotent and revision-safe.
- Make purge explicit, destructive, and confirmation-gated.
- Run bounded daily cleanup without logging content.
- Preserve session-derived authorization and no-store responses.

**Non-Goals:**

- Folder writes, folder tombstones, or folder delete.
- Trash UI or client cache.
- Restoring a purged row.
- Changing the 30-day retention policy.

## Decisions

### Soft delete and restore use conditional batches

Add query statements that allocate a revision only when the item is in the expected state:

```text
UPDATE users SET vault_rev = vault_rev + 1
WHERE id = ? AND EXISTS (
  SELECT 1 FROM vault_items
  WHERE id = ? AND user_id = ? AND deleted_at IS NULL      -- delete
)

UPDATE vault_items
SET deleted_at = ?, rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL
RETURNING <item columns>
```

Restore is the mirror with `deleted_at IS NOT NULL` and `deleted_at = NULL`. If the item update changes zero rows, the use case reads the current row. If the row exists, the operation is already in the requested state: return it without a rev bump. If the row is missing or foreign, return 404.

Why conditional: a repeated delete/restore must not inflate `serverRev`; why batch: D1 has no interactive transaction and the rev must commit with the state change.

### Purge erases ciphertext and keeps a synced tombstone

Purge requires the body `{ "confirm": true }` and runs a conditional batch:

```text
UPDATE users SET vault_rev = vault_rev + 1
WHERE id = ? AND EXISTS (
  SELECT 1 FROM vault_items
  WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND data_ct <> ''
)

UPDATE vault_items
SET data_ct = '', data_iv = '', rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND data_ct <> ''
RETURNING <item columns>
```

The response is the tombstone with 200. Keeping the row lets other devices receive `rev > since` and drop the item deterministically; the ciphertext is gone immediately and the daily cron removes the metadata after retention. A repeat purge changes no row and returns the current tombstone without a rev bump. Purging an active item returns 404. This intentionally deviates from the task's “allocate a new rev and return the row” step for purge because a hard delete cannot be synced to offline devices.

### DELETE needs Origin without a body

`readMutationJson` requires a JSON body, which `DELETE` does not have. Add a small origin-only helper in `app/lib/.server/json-action.ts` that applies the same `APP_ORIGIN`/development rule and returns a 403-shaped result. Restore and purge continue to use `readMutationJson` with strict body schemas.

### Cron runs bounded deletes

`workers/app.ts` gains a `scheduled` handler. It calls a vault use case that loops:

```sql
DELETE FROM vault_items
WHERE id IN (
  SELECT id FROM vault_items
  WHERE deleted_at IS NOT NULL AND deleted_at < ?
  LIMIT 1000
)
```

until a batch deletes fewer than 1000 rows or a safety cap is reached. The cutoff is `Date.now() - 30 days`. The handler logs only `vault.purge` and the count. `wrangler.jsonc` adds `"triggers": { "crons": ["0 3 * * *"] }`.

### Routes and method dispatch

- `DELETE /api/vault/items/:id` is handled in the existing item route action alongside PATCH.
- `POST /api/vault/items/:id/restore` and `POST /api/vault/items/:id/purge` get resource routes.
- All mutations authenticate first, rate-limit by IP, check method, then validate Origin/body.
- Every response sets `Cache-Control: no-store`.
- Foreign ids return 404; no handler accepts `user_id` from input.

## Risks / Trade-offs

- **Purge is not repeatable with 200** -> accepted; the effect is idempotent and absence is the expected post-purge state. The spec states this explicitly.
- **Purged rows cannot deliver a delta** -> solved by keeping a ciphertext-free tombstone with a new rev; the cron removes it after retention.
- **Cron loops could run long** -> bounded batch size and a safety cap; log counts only.
- **Delete/restore race** -> conditional state and rev in one batch; the loser reads the current state and returns it.
- **Origin-only DELETE bypass** -> use the same helper rule as JSON mutations; tests cover foreign Origin.

## Migration Plan

1. Add query/use-case modules and route handlers; no D1 migration.
2. Add the cron trigger and scheduled handler; deploy verifies Wrangler accepts the trigger.
3. Verify delete → sync tombstone → restore, then purge → row absent.
4. Roll back by reverting routes and the cron trigger; existing tombstones remain valid.

## Open Questions

None.
