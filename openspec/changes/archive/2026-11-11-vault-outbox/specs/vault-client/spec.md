# Spec Delta

## ADDED Requirements

### Requirement: Durable encrypted outbox

The browser SHALL persist pending vault mutations in an IndexedDB outbox store. Each entry MUST contain only the operation type, ciphertext/metadata payload, idempotency id where applicable, and queue metadata. The outbox MUST survive reload and MUST be wiped with every other store on logout or account switch.

#### Scenario: Offline mutation survives reload
- **WHEN** a mutation is enqueued while offline
- **THEN** reopening the database still returns the pending entry

#### Scenario: Outbox stores no plaintext
- **WHEN** outbox records are inspected
- **THEN** they contain no plaintext item fields or unwrapped vault key

#### Scenario: Logout wipes outbox
- **WHEN** the user signs out
- **THEN** the outbox contains no entries

### Requirement: Ordered outbox flush

`flush()` SHALL process entries in insertion order, remove an entry only after its server success, and stop at the first network or server failure so later entries remain queued. Successful create responses SHALL replace the optimistic cached row with the server row and revision.

#### Scenario: In-order flush
- **WHEN** multiple entries are queued
- **THEN** requests are sent in enqueue order

#### Scenario: Stop on first failure
- **WHEN** an entry fails with a network or 5xx error
- **THEN** that entry remains queued, later entries are untouched, and no further request is sent

#### Scenario: Reopen then flush
- **WHEN** a queued create is retried after reopening the database
- **THEN** it is sent once with its original idempotency id

### Requirement: Conflict and rollback handling

A 409 response SHALL remove the optimistic local mutation, trigger a vault refetch, retain any later queue entries, and emit a conflict event for the UI. A 4xx validation failure MUST remove the rejected entry and emit an error event without retrying forever.

#### Scenario: Conflict
- **WHEN** an update flushes with a stale revision
- **THEN** the optimistic change is rolled back, a refetch starts, and a conflict event is emitted

#### Scenario: Validation rejection
- **WHEN** the server rejects a queued mutation with 400
- **THEN** the entry is removed and no retry loop occurs

#### Scenario: Success clears entry
- **WHEN** an entry succeeds
- **THEN** it is removed from the outbox and the cached row reflects the server response
