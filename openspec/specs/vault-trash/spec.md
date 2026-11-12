# vault-trash Specification

## Purpose
Defines the trash surface for soft-deleted vault items, including decrypted trash listing, restore, permanent purge, confirmation, and navigation visibility.

## Requirements

### Requirement: Trash projection

The client SHALL build a trash projection from cached tombstones while the vault is unlocked. It MUST decrypt the name and type of restorable tombstones, join folder labels where available, and exclude purged tombstones whose ciphertext is empty.

#### Scenario: List deleted item
- **WHEN** the cache contains a soft-deleted item with non-empty ciphertext
- **THEN** the trash projection includes its decrypted name, type, folder label when available, and deletion date

#### Scenario: Purged tombstone
- **WHEN** a tombstone has empty ciphertext or IV
- **THEN** it is not listed as restorable

#### Scenario: Corrupt tombstone
- **WHEN** a tombstone cannot be decrypted or validated
- **THEN** it is skipped without failing the remaining trash list

### Requirement: Trash route

`/app/trash` SHALL render the authenticated user's soft-deleted items, with an empty state and a loading state. It MUST remain inside the vault lock boundary.

#### Scenario: Trash has items
- **WHEN** the user opens the trash with restorable tombstones
- **THEN** each row shows the item name, type, deletion date, and available folder

#### Scenario: Empty trash
- **WHEN** no restorable tombstones exist
- **THEN** the route shows the trash empty state

#### Scenario: Locked vault
- **WHEN** the vault is locked
- **THEN** trash content is not rendered and the locked overlay is shown

### Requirement: Trash navigation count

The authenticated navigation SHALL expose a trash link with a count of restorable tombstones and MUST hide the count when zero. The link MUST be reachable by keyboard.

#### Scenario: Count appears
- **WHEN** one or more restorable tombstones exist
- **THEN** the navigation shows a trash link with the count

#### Scenario: Count disappears
- **WHEN** no restorable tombstones remain
- **THEN** the navigation shows the trash link without a numeric count

### Requirement: Restore from trash

Restore SHALL queue an `item.restore` mutation through the outbox, update the optimistic cache, and remove the item from the trash list. A restored item MUST retain its original folder reference.

#### Scenario: Restore item
- **WHEN** the user restores a deleted item
- **THEN** the item becomes live again with its original folder and disappears from trash

#### Scenario: Restore failure
- **WHEN** restore is rejected or the request fails
- **THEN** the row remains in trash and a generic retryable error is shown

#### Scenario: Purged item cannot restore
- **WHEN** a purged tombstone is requested
- **THEN** it is not offered as a restorable row

### Requirement: Purge confirmation

Permanent purge SHALL require an explicit confirmation dialog. When trash contains more than five restorable items, confirmation MUST require typing the exact item name; otherwise a destructive confirm action is sufficient. The confirm action MUST be disabled until the typed name matches.

#### Scenario: Large trash requires name
- **WHEN** trash has more than five items and the user purges one
- **THEN** the confirm action stays disabled until the exact name is entered

#### Scenario: Small trash confirm
- **WHEN** trash has five or fewer items and the user purges one
- **THEN** a destructive confirmation dialog is sufficient

#### Scenario: Cancel purge
- **WHEN** the user cancels confirmation
- **THEN** no purge mutation is queued and the item remains

### Requirement: Permanent purge

Confirmed purge SHALL queue an `item.purge` mutation through the outbox and remove the item from trash only after the optimistic cache reflects the purge. The action MUST be irreversible and MUST NOT expose plaintext to the server.

#### Scenario: Purge item
- **WHEN** the user confirms purge
- **THEN** the item is removed from trash and its cached ciphertext is cleared

#### Scenario: Purge failure
- **WHEN** purge fails
- **THEN** the item remains available in trash and a generic error is shown

### Requirement: Trash exclusion

Soft-deleted items SHALL NOT appear in the live vault list or in future search results. Restored items SHALL return to the live list.

#### Scenario: Trashed item excluded
- **WHEN** an item is soft-deleted
- **THEN** it does not appear in the live vault list

#### Scenario: Restored item included
- **WHEN** an item is restored
- **THEN** it appears in the live vault list under its folder
