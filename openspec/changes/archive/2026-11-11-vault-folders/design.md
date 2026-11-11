# Design

## Context

See `proposal.md` - Why. `vault_items` already has `deleted_at` and the sync delta returns item tombstones. `folders` has no tombstone column, so hard deletion cannot be delivered to offline devices. Item create/update already validates folder ownership through `findOwnedFolder`, but that query does not yet exclude deleted folders. The vault query factory, cursor, transport, and route conventions are established.

## Goals / Non-Goals

**Goals:**

- Add active-folder listing, create, rename, and soft delete.
- Make folder deletion observable through sync.
- Detach contained items atomically with the folder tombstone and the same revision.
- Prevent references to deleted or foreign folders.
- Preserve ciphertext-only folder names.

**Non-Goals:**

- Folder purge or tombstone retention policy.
- Nested folders or organizations.
- Client cache/UI.
- Changing item trash semantics.

## Decisions

### Add a folder tombstone column

Migration `0013_folder_tombstones.sql`:

```sql
ALTER TABLE folders ADD COLUMN deleted_at INTEGER;
CREATE INDEX idx_folders_user_deleted ON folders (user_id, deleted_at);
```

`deleted_at` is nullable. Active folder queries add `deleted_at IS NULL`. Sync includes folder tombstones. Folder name ciphertext is capped at 4KB; creation is rejected at 500 active or 2000 total rows. The daily purge removes folder tombstones older than 30 days alongside item tombstones.

Why not hard-delete: an offline device would never learn the folder disappeared. Why not reuse item tombstones: folders have a different shape and no ciphertext body.

### Folder create and rename use conditional rev batches

Create uses the same pattern as items:

```text
UPDATE users SET vault_rev = vault_rev + 1, updated_at = ? WHERE id = ?
INSERT INTO folders (...) SELECT ..., vault_rev, ... FROM users WHERE id = ?
RETURNING <folder columns>
```

Rename:

```text
UPDATE users SET vault_rev = vault_rev + 1
WHERE id = ? AND EXISTS (
  SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND rev = ? AND deleted_at IS NULL
)

UPDATE folders
SET name_ct = ?, name_iv = ?, data_version = ?,
    rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
WHERE id = ? AND user_id = ? AND rev = ? AND deleted_at IS NULL
RETURNING <folder columns>
```

A stale rev changes zero rows; the use case returns 409 with the current active row. A deleted/foreign/missing folder returns 404.

### Delete detaches items with one shared revision

Delete is one D1 batch:

```text
UPDATE users SET vault_rev = vault_rev + 1
WHERE id = ? AND EXISTS (
  SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL
)

UPDATE folders
SET deleted_at = ?, rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL
RETURNING <folder columns>

UPDATE vault_items
SET folder_id = NULL, rev = (SELECT vault_rev FROM users WHERE id = ?), updated_at = ?
WHERE user_id = ? AND folder_id = ?
```

All detached items, including tombstones, share the new revision with the folder tombstone. Sync ordering is `(rev, id)`, so the cursor handles equal revisions deterministically. One global revision is enough; per-item revisions would require per-row statements without improving the contract.

If the folder update changes zero rows, read the folder including tombstones. An existing deleted folder means the delete was already applied: return its tombstone without a revision bump. A missing or foreign folder returns 404.

### Active folder ownership

`findOwnedFolder` becomes active-only (`deleted_at IS NULL`) for item create/update and folder rename. Add `findAnyOwnedFolder` for the idempotent delete lookup. Item create/update continues to return 404 for a deleted or foreign folder.

### Sync and transport changes

The folder branch of the delta union selects `deleted_at`; item branch already does. `VaultFolderRow`, `VaultFolderResponse`, and `toFolderResponse` gain `deletedAt`. No client cache is present yet, so this is an additive contract change.

### Routes and validation

- `GET /api/folders` lists active folders for the session user, capped at 500.
- `POST /api/folders` accepts strict `{nameCt,nameIv,dataVersion}`.
- `PATCH /api/folders/:id` accepts strict name fields plus `rev`.
- `DELETE /api/folders/:id` is body-less and uses the origin-only mutation guard.
- All mutations authenticate first, IP rate-limit, check method/id, validate Origin/body, and return `no-store`.

### Tombstones share the 30-day retention

Folder tombstones are removed by the existing daily purge once older than 30 days, matching item tombstone retention. This bounds metadata and ciphertext growth. A device offline longer than the window can miss the tombstone, but its detached items still arrive with `folderId: null`.

## Risks / Trade-offs

- **Tombstone growth** -> bounded by the 30-day cleanup and the folder creation caps.
- **Shared revision for detached items** -> accepted; sync uses `(rev,id)` and all rows are delivered exactly once.
- **Folder deletion while an item is edited** -> item update guards folder ownership; after deletion the edit returns 404 rather than attaching to a deleted folder.
- **Rename/delete race** -> both allocate and mutate in conditional batches; exactly one transition wins.
- **Large folder with many items** -> one batch has one update per item? No: a single bulk `UPDATE vault_items` statement handles all matching items, so the batch stays three statements.
- **Legacy rows** -> nullable `deleted_at` reads as active; no backfill needed.

## Migration Plan

1. Apply the folder tombstone migration.
2. Deploy folder routes and active-folder checks.
3. Verify create → rename → delete, then confirm sync returns the folder tombstone and detached item revisions.
4. Roll back application code first; the nullable column is harmless. Do not drop it forward-only.

## Open Questions

None.
