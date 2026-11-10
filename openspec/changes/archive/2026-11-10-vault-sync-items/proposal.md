# Proposal

## Why

The app can authenticate and manage accounts, but it still has no ciphertext vault API. The client cache, list, editors, offline unlock, and auto-lock all depend on a stable sync and item mutation contract. This change delivers that contract for items and read-only folders, leaving trash and folder writes as separate changes so each PR stays reviewable.

## What Changes

- Add an authenticated vault delta endpoint `GET /api/vault?since=<rev>&cursor=<cursor>` returning items and folders with `rev` greater than the watermark, tombstones included, capped at 500 rows plus `nextCursor` and `serverRev`.
- Add `POST /api/vault/items` for encrypted item creation with a globally increasing `rev` allocated in the same D1 batch as the insert.
- Add `PATCH /api/vault/items/:id` with optimistic concurrency: the client sends the current `rev`; a mismatch returns 409 with the current row and never overwrites.
- Scope every query by the session user. Foreign or unknown item and folder ids return 404, never 403.
- Validate every body with a strict schema: ciphertext and IV lengths, 64KB ciphertext cap, type/favorite/dataVersion rules, unknown keys rejected, and the existing 256KB body cap.
- Keep folder creation, rename, delete, trash/restore/purge, and the purge cron out of this change.
- Expose only ciphertext, IVs, and metadata; the server never decrypts or inspects vault content.

## Capabilities

### New Capabilities

- `vault-api`: authenticated ciphertext sync, item creation, optimistic item updates, per-user authorization, and payload validation.

### Modified Capabilities

None.

## Impact

- New `app/server/vault/` domain modules for rev allocation, delta queries, item use cases, ownership checks, and transport mapping.
- New `app/server/vault/queries/` modules for items, folders, and rev allocation.
- New routes `app/routes/api.vault.ts`, `app/routes/api.vault.items.ts`, and `app/routes/api.vault.items.$id.ts`; `app/routes.ts` update.
- New request/response schemas and tests, including cross-user isolation, stale rev, pagination, tombstones, and oversize bodies.
- No migration: the vault tables and indexes already exist.
- No client cache or UI in this change.
