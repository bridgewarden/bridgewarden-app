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

`POST /api/vault/items` SHALL create an encrypted item for the session user with a `rev` strictly greater than the user's previous `serverRev`. Rev allocation and insertion MUST commit atomically; a failed insert MUST NOT leave a committed item or consume a revision without a row.

#### Scenario: Create succeeds
- **WHEN** a valid item body is submitted by an authenticated user
- **THEN** the response is 201 with the created row and its new `rev`

#### Scenario: Revision advances
- **WHEN** an item is created
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
