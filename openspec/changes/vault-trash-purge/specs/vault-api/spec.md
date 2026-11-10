# Spec Delta

## ADDED Requirements

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
