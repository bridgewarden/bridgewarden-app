# vault-api Specification

## Purpose
Provides the authenticated ciphertext vault contract used by the client cache and editors: incremental sync, item creation, optimistic item updates, strict per-user authorization, and payload validation without server-side decryption.

## Requirements

### Requirement: Incremental vault sync

`GET /api/vault` SHALL return the authenticated user's items and folders whose `rev` is greater than the requested `since` watermark, including tombstones, together with `serverRev` and an opaque `nextCursor` when more rows remain. The endpoint MUST cap a page at 500 rows and MUST NOT decrypt or expose plaintext vault content.

#### Scenario: Initial sync
- **WHEN** a user calls sync with `since=0`
- **THEN** the response contains that user's live items and folders and the current `serverRev`

#### Scenario: Empty delta
- **WHEN** a user calls sync with the latest `serverRev`
- **THEN** the response contains no items or folders and no `nextCursor`

#### Scenario: Tombstones included
- **WHEN** an item was deleted after the requested `since`
- **THEN** the delta includes that item with `deletedAt` set

#### Scenario: Page cap
- **WHEN** more than 500 rows match the delta
- **THEN** the response returns 500 rows and a `nextCursor` that resumes after the last returned row

#### Scenario: No plaintext on the wire
- **WHEN** a sync response is inspected
- **THEN** it contains only identifiers, ciphertext, IVs, metadata, timestamps, and revision values

### Requirement: Atomic item creation

`POST /api/vault/items` SHALL create an encrypted item for the session user with a `rev` above the previous `serverRev`. The body MAY include a client UUID `id`. Allocation and insert MUST be atomic and MUST NOT duplicate an owned id or consume another revision on replay. New returns 201; replay returns 200.

#### Scenario: Create succeeds
- **WHEN** a valid item body without an id is submitted by an authenticated user
- **THEN** the response is 201 with the server-generated id and a new `rev`

#### Scenario: Client id accepted
- **WHEN** a valid body includes a UUID id
- **THEN** the created row uses that id and a new revision

#### Scenario: Idempotent replay
- **WHEN** the same owned id is submitted again
- **THEN** the response is 200 with the existing row and no revision is consumed

#### Scenario: Foreign id collision
- **WHEN** the id belongs to another user
- **THEN** the response is 404 and no foreign row is revealed

#### Scenario: Invalid id
- **WHEN** the provided id is not a valid UUID
- **THEN** the response is 400

#### Scenario: Revision advances
- **WHEN** a new item is created
- **THEN** the user's `serverRev` increases and the item is visible in the next delta

#### Scenario: Missing folder
- **WHEN** the item references a folder that does not belong to the session user
- **THEN** the response is 404 and no item is written

#### Scenario: Failed insert rolls back
- **WHEN** the insert statement fails after rev allocation
- **THEN** the batch leaves no item and no committed rev allocation

### Requirement: Optimistic item update

`PATCH /api/vault/items/:id` SHALL require the client's current `rev`. A matching revision SHALL replace the encrypted item fields and advance `rev`; a mismatch MUST return 409 with the current server row and MUST NOT overwrite it. Unknown or foreign ids MUST return 404.

#### Scenario: Update succeeds
- **WHEN** the client sends the current `rev` and valid encrypted fields
- **THEN** the item is updated, its `rev` increases, and the change appears in the next delta

#### Scenario: Stale revision
- **WHEN** the client sends an older `rev`
- **THEN** the response is 409 with the current row and the stored row is unchanged

#### Scenario: Foreign item
- **WHEN** the item belongs to another user
- **THEN** the response is 404

### Requirement: Per-user authorization

Every vault handler SHALL derive the user id from the session. Item and folder ownership MUST be verified before mutation, and foreign identifiers MUST return 404 rather than 403. No handler may accept `user_id` from a body or query parameter.

#### Scenario: Cross-user read
- **WHEN** a user requests sync for another user's rows
- **THEN** only the session user's rows are returned

#### Scenario: Cross-user mutation
- **WHEN** a user updates another user's item
- **THEN** the response is 404 and the other user's row is unchanged

#### Scenario: Body user id ignored
- **WHEN** a request body contains a `user_id` field
- **THEN** the strict schema rejects it and the session identity remains authoritative

### Requirement: Vault payload validation

Vault mutation bodies SHALL be validated at the boundary with strict schemas. Ciphertext MUST decode from canonical base64url and be at most 64KB, IVs MUST be 12 bytes, `dataVersion` MUST be at least 1, `type` MUST be `login` or `note`, and unknown fields MUST be rejected. Requests over 256KB MUST return 413; malformed or oversized encrypted fields MUST return 400 without logging payload contents.

#### Scenario: Oversized body
- **WHEN** a request body exceeds 256KB
- **THEN** the response is 413

#### Scenario: Malformed ciphertext
- **WHEN** a ciphertext field is not canonical base64url or exceeds 64KB
- **THEN** the response is 400

#### Scenario: Unknown field
- **WHEN** a body contains a field outside the schema
- **THEN** the response is 400

#### Scenario: No payload logging
- **WHEN** validation fails
- **THEN** logs contain no ciphertext, IV, token, or raw body content

### Requirement: Soft delete and restore items

`DELETE /api/vault/items/:id` SHALL set `deletedAt` and advance the item revision for the session user's active item. `POST /api/vault/items/:id/restore` SHALL clear `deletedAt` and advance the revision for the session user's deleted item. Repeating an operation when the item is already in the requested state SHALL return the current row without consuming another revision. Unknown and foreign ids MUST return 404.

#### Scenario: Soft delete
- **WHEN** a user deletes an active item
- **THEN** the item is returned with `deletedAt` set and a higher revision, and appears as a tombstone in sync

#### Scenario: Restore
- **WHEN** a user restores a deleted item
- **THEN** `deletedAt` is null, the revision advances, and the item is live in sync

#### Scenario: Repeated delete
- **WHEN** a user deletes an item that is already deleted
- **THEN** the current tombstone is returned and no revision is consumed

#### Scenario: Foreign item
- **WHEN** a user deletes or restores another user's item
- **THEN** the response is 404 and the row is unchanged

### Requirement: Permanent item purge

`POST /api/vault/items/:id/purge` SHALL require a strict body with `confirm: true` and permanently erase the ciphertext and IV of the session user's soft-deleted item while retaining a metadata tombstone until scheduled cleanup. A missing or false confirmation MUST return 400. Foreign, unknown, and active ids MUST return 404. Repeating a purge MUST return the tombstone without consuming another revision.

#### Scenario: Purge confirmed
- **WHEN** the owner sends `confirm: true` for a deleted item
- **THEN** the ciphertext and IV are erased, the tombstone remains, and its revision advances

#### Scenario: Confirmation required
- **WHEN** the body omits `confirm` or sets it to false
- **THEN** the response is 400 and the item remains

#### Scenario: Purge before delete
- **WHEN** the item is not soft-deleted
- **THEN** the response is 404 and the item remains

#### Scenario: Repeated purge
- **WHEN** the owner purges an already purged tombstone
- **THEN** the tombstone is returned and no revision is consumed

#### Scenario: Foreign purge
- **WHEN** a user purges another user's item
- **THEN** the response is 404 and the row remains

### Requirement: Scheduled trash purge

The Worker SHALL run a daily scheduled task at `0 3 * * *` that permanently removes items whose `deletedAt` is older than 30 days. Cleanup MUST run in bounded batches and MUST log only counts or event names, never item ids or ciphertext.

#### Scenario: Expired tombstone removed
- **WHEN** the cron runs and an item was deleted more than 30 days ago
- **THEN** the row is removed

#### Scenario: Recent tombstone retained
- **WHEN** the cron runs and an item was deleted less than 30 days ago
- **THEN** the row remains

#### Scenario: Bounded batches
- **WHEN** more expired rows exist than the batch size
- **THEN** the task repeats batches until no expired rows remain

### Requirement: Trash mutation authorization and limits

Trash and purge handlers SHALL derive the user id from the session, enforce same-origin requests, and return `Cache-Control: no-store`. Responses MUST NOT contain plaintext vault content or request payloads in logs.

#### Scenario: Unauthenticated trash request
- **WHEN** a request has no valid session
- **THEN** the response is 401

#### Scenario: Foreign origin
- **WHEN** a mutation request has a foreign Origin
- **THEN** the response is 403 and no mutation occurs

### Requirement: Folder listing and creation

`GET /api/folders` SHALL return the session user's active folders with ciphertext names, IVs, versions, revisions, and timestamps. `POST /api/folders` SHALL create an encrypted folder with a new global revision. Foreign data, plaintext names, and client-supplied `user_id` MUST NOT be accepted. Folder name ciphertext MUST be at most 4KB; creation MUST be rejected with 409 when the user already has 500 active folders or 2000 total folder rows.

#### Scenario: Create folder
- **WHEN** an authenticated user submits a valid encrypted folder
- **THEN** the response is 201 with the created folder and a new revision

#### Scenario: List folders
- **WHEN** a user lists folders
- **THEN** only that user's active folders are returned

#### Scenario: Folder limit reached
- **WHEN** an active or total folder limit would be exceeded
- **THEN** the response is 409 and no row is created

#### Scenario: Invalid folder body
- **WHEN** ciphertext, IV, version, or unknown fields violate the strict schema
- **THEN** the response is 400

### Requirement: Folder rename concurrency

`PATCH /api/folders/:id` SHALL require the client's current `rev`. A matching revision SHALL replace the encrypted name fields and advance the revision; a mismatch MUST return 409 with the current folder and MUST NOT overwrite it. Unknown or foreign folders MUST return 404.

#### Scenario: Rename succeeds
- **WHEN** the owner sends the current revision and valid encrypted name fields
- **THEN** the folder is updated and the new revision appears in sync

#### Scenario: Stale rename
- **WHEN** the owner sends an older revision
- **THEN** the response is 409 with the current folder and no overwrite

#### Scenario: Foreign folder rename
- **WHEN** the folder belongs to another user
- **THEN** the response is 404

### Requirement: Folder soft delete and tombstone sync

`DELETE /api/folders/:id` SHALL soft-delete the session user's active folder, assign it a new revision, and detach every contained item by setting `folderId` to null with the same new revision. The folder tombstone MUST appear in the vault delta so offline devices can remove it. Tombstones MAY be removed after 30 days. Repeating delete MUST return the tombstone without consuming another revision. Unknown or foreign folders MUST return 404.

#### Scenario: Delete detaches items
- **WHEN** the owner deletes a folder containing items
- **THEN** the folder tombstone and every detached item carry the same new revision

#### Scenario: Tombstone in sync
- **WHEN** a folder was deleted after the requested watermark
- **THEN** the delta includes the folder with `deletedAt` set

#### Scenario: Repeated delete
- **WHEN** the owner deletes an already deleted folder
- **THEN** the tombstone is returned and no revision is consumed

#### Scenario: Foreign folder delete
- **WHEN** a user deletes another user's folder
- **THEN** the response is 404 and nothing changes

### Requirement: Active folder references

Item create and update SHALL accept a folder reference only when the folder belongs to the session user and is active. Deleted folders MUST NOT be attachable to items.

#### Scenario: Deleted folder rejected
- **WHEN** an item create or update references a deleted folder
- **THEN** the response is 404 and the item is unchanged

#### Scenario: Foreign folder rejected
- **WHEN** an item references another user's folder
- **THEN** the response is 404

### Requirement: Purged tombstones cannot be restored

An item whose ciphertext was erased by purge MUST NOT be restorable. Restore SHALL require a soft-deleted row with non-empty ciphertext.

#### Scenario: Restore purged item
- **WHEN** the owner restores an item whose ciphertext and IV are empty
- **THEN** the request is rejected as not found or conflict and the row stays purged
