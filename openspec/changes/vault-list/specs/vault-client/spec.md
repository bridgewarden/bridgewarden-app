# Spec Delta

## ADDED Requirements

### Requirement: Validated plaintext payloads

The client SHALL define versioned plaintext payloads for login items, secure notes, and folder names, validated with a schema before display or encryption. Invalid or corrupt ciphertext MUST be skipped without failing the whole list.

#### Scenario: Valid login payload
- **WHEN** a cached login decrypts to a name and optional username, URLs, notes, secret, and custom fields
- **THEN** it becomes a list item with a folder name and metadata

#### Scenario: Valid note payload
- **WHEN** a cached note decrypts to a name and body
- **THEN** it becomes a note list item without a username

#### Scenario: Corrupt item
- **WHEN** one cached row fails decryption or schema validation
- **THEN** that row is omitted and the remaining rows still render

#### Scenario: Invalid folder payload
- **WHEN** a folder name fails decryption or validation
- **THEN** its items remain visible with no folder label

### Requirement: Decrypted vault projection

The client SHALL project cached rows into decrypted views only while the vault is unlocked. It MUST exclude tombstones, join folder names, and never persist the decrypted projection.

#### Scenario: Tombstones excluded
- **WHEN** the cache contains deleted items or folders
- **THEN** they do not appear in the default list or folder options

#### Scenario: Lock clears decrypted state
- **WHEN** the vault locks
- **THEN** decrypted list state is unmounted and no plaintext projection remains in storage

### Requirement: Vault list sorting and filters

The list SHALL support sorting by name or last updated and combined filters for type, folder, and favorite. Filters SHALL compose rather than replace each other.

#### Scenario: Combined filters
- **WHEN** the user filters to logins in a folder and favorites only
- **THEN** only rows matching all three predicates render

#### Scenario: Sort by updated
- **WHEN** the user selects last updated
- **THEN** rows order by `updatedAt` descending

#### Scenario: Large list
- **WHEN** 500 items are projected
- **THEN** the list renders without blocking input and uses stable row keys

### Requirement: Keyboard list navigation

Unlocked list rows SHALL support `j`/`k`, ArrowDown/ArrowUp, and Enter. Enter SHALL open a read-only detail for the active row. Shortcuts MUST NOT fire while typing in an input, select, or textarea.

#### Scenario: Move active row
- **WHEN** the user presses `j` or ArrowDown
- **THEN** the next visible row becomes active and is scrolled into view

#### Scenario: Open active row
- **WHEN** the user presses Enter on the active row
- **THEN** a read-only detail dialog opens

#### Scenario: Form focus
- **WHEN** a filter or dialog field has focus
- **THEN** list navigation shortcuts do not move the active row

### Requirement: Minimal encrypted item creation

The empty state SHALL offer a create action that encrypts a minimal named login or note, writes an optimistic cache row and outbox entry, and refreshes the list. The outbox MUST send standard-base64 cache ciphertext as base64url at the HTTP boundary.

#### Scenario: Create from empty state
- **WHEN** the user submits a valid name, type, folder, and favorite
- **THEN** the item appears immediately and a queued create is flushed

#### Scenario: Offline create
- **WHEN** creation is submitted offline
- **THEN** it remains in the outbox and appears after reload

#### Scenario: Transport encoding
- **WHEN** the outbox sends item or folder ciphertext
- **THEN** standard-base64 cache values become valid base64url request fields

#### Scenario: Invalid name
- **WHEN** the name is empty or over the limit
- **THEN** the dialog shows an inline error and does not enqueue
