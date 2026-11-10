# Proposal

## Why

Items can be created and updated but cannot be deleted. Completing the item lifecycle now gives editors and the trash UI a stable contract and prevents deleted ciphertext from accumulating forever. The sync endpoint already returns tombstones, so soft delete fits the existing client model.

Requirement: `TASK-32`.

## What Changes

- Add `DELETE /api/vault/items/:id` for soft delete, setting `deleted_at` and advancing the item revision.
- Add `POST /api/vault/items/:id/restore` to clear `deleted_at` and advance the revision.
- Add `POST /api/vault/items/:id/purge` with an explicit `{confirm:true}` body to erase ciphertext while retaining a synced metadata tombstone until scheduled cleanup.
- Keep delete/restore idempotent: repeating the operation on an item already in the requested state returns the current row without consuming a revision.
- Require the session user for every operation; foreign and unknown ids return 404.
- Add a daily Worker cron at `0 3 * * *` that permanently removes tombstones older than 30 days in bounded batches.
- Validate purge confirmation and continue returning `Cache-Control: no-store` on every response.
- Keep folder writes out of scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-api`: add the item trash/restore/purge lifecycle, idempotency, authorization, and scheduled purge requirements.

## Impact

- New query and use-case modules under `app/server/vault/`.
- `DELETE` added to the existing item route; new restore and purge routes; `app/routes.ts` update.
- `workers/app.ts` scheduled handler and `wrangler.jsonc` cron trigger.
- New tests for lifecycle, cross-user 404, idempotency, tombstone sync, cutoff behavior, and cron batching.
- No schema change and no client cache/UI in this change.
