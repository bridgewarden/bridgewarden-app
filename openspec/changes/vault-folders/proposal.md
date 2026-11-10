# Proposal

## Why

Vault items can reference folders, but there is no folder API and no way to delete a folder without losing sync correctness. The client list, filters, and editors need folder create, rename, list, and delete. Folder delete must be represented as a tombstone so offline devices learn that the folder is gone and their items were detached.

Requirement: `TASK-33`.

## What Changes

- Add `GET /api/folders` for active folders and `POST /api/folders` for encrypted folder creation.
- Add `PATCH /api/folders/:id` for rename with optimistic `rev` and 409 conflict.
- Add `DELETE /api/folders/:id` as a soft delete. One conditional batch increments `vault_rev`, marks the folder deleted, and detaches every contained item with the same new revision.
- Add `folders.deleted_at` through a forward-only migration plus a user/deleted index.
- Include folder tombstones in `GET /api/vault` with `deletedAt`, and expose `deletedAt` on folder responses.
- Allow item create/update to reference only active folders.
- Keep folder tombstones indefinitely for now; no device tracking exists that could safely purge them.
- Enforce session ownership, 404 for foreign ids, strict ciphertext validation, 256KB body cap, IP rate limits, and `no-store`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-api`: add folder list/create/rename/delete, tombstone sync, and active-folder rules.
- `data-model`: add folder tombstone storage while preserving ciphertext-only names and detach-on-delete behavior.

## Impact

- Migration `0013_folder_tombstones.sql`.
- `app/server/vault/` folder queries, use cases, input schemas, transport, query factory.
- Routes `api.folders.ts`, `api.folders.$id.ts`, `app/routes.ts`.
- Sync union and folder response shape gain `deletedAt`.
- Tests for folder CRUD, cross-user 404, stale rev, tombstone sync, detach-with-same-rev, and item active-folder rules.
- No folder purge, no client cache/UI, no attachments.
