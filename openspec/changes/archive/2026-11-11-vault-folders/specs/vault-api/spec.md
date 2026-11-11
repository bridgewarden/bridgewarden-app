# Spec Delta

## ADDED Requirements

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
