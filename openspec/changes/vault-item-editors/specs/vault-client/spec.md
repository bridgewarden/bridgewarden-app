# Spec Delta

## ADDED Requirements

### Requirement: Full item editor

The client SHALL provide protected create and edit routes for login items and secure notes. A login editor MUST expose name, username, password, multiple URLs, notes, folder, favorite, TOTP secret, and custom fields with a hidden toggle. A note editor MUST expose name, body, folder, and favorite.

#### Scenario: Create a login
- **WHEN** the user opens the create route and submits valid login fields
- **THEN** the encrypted login is queued and appears in the list

#### Scenario: Edit a secure note
- **WHEN** the user opens an existing note and saves a changed body
- **THEN** the encrypted update is queued and the list shows the new body-derived content

#### Scenario: Required name
- **WHEN** the user submits an item with an empty name
- **THEN** save is blocked with an inline error and nothing is queued

#### Scenario: Secret fields
- **WHEN** a login editor renders before unlock
- **THEN** no password, TOTP secret, or custom-field value appears in SSR output

### Requirement: Full payload editing

Editing SHALL decrypt the full cached item payload while the vault is unlocked. The list projection MUST remain a reduced view, and decrypted editor state MUST NOT be written to storage, URLs, logs, or SSR output.

#### Scenario: Open login for editing
- **WHEN** an unlocked user edits a login
- **THEN** username, password, URLs, notes, TOTP secret, and custom fields are available in memory

#### Scenario: Lock while editing
- **WHEN** the vault locks with an editor open
- **THEN** decrypted editor state is unmounted and the locked overlay is shown

#### Scenario: Corrupt item
- **WHEN** the cached payload cannot be decrypted or validated
- **THEN** the editor reports an unreadable item and does not overwrite it

### Requirement: Editor writes through the outbox

Saving SHALL validate the payload, encrypt it with the in-memory vault key, enqueue a create or update with the current revision, update the optimistic cache row, and refresh the list. The server MUST receive ciphertext and metadata only.

#### Scenario: Create through editor
- **WHEN** a valid new item is saved
- **THEN** an `item.create` entry with a client UUID is queued and flushed

#### Scenario: Update through editor
- **WHEN** a valid existing item is saved with its current revision
- **THEN** an `item.update` entry is queued and the cache row is replaced optimistically

#### Scenario: Offline save
- **WHEN** the user saves while offline
- **THEN** the item remains queued and is visible from the cache after reload

#### Scenario: Ciphertext at rest
- **WHEN** the item is persisted locally or remotely
- **THEN** name, username, password, note body, TOTP secret, and custom fields exist only inside ciphertext

### Requirement: Bounded plaintext item payloads

Login and note payloads SHALL enforce name 256 characters, username 256 characters, password 1024 characters, at most 10 URLs, at most 20 custom fields, and a note body of at most 50KB UTF-8. A payload that would exceed the server ciphertext budget MUST be rejected client-side with a clear error.

#### Scenario: Maximum note body
- **WHEN** a valid 50KB note body is saved
- **THEN** it encrypts, uploads, and reloads unchanged

#### Scenario: Oversized note body
- **WHEN** the note body exceeds 50KB
- **THEN** save is blocked with an inline error and nothing is queued

#### Scenario: Excess list entries
- **WHEN** a login has more than 10 URLs or more than 20 custom fields
- **THEN** validation blocks save with an inline error

#### Scenario: Payload budget
- **WHEN** the combined plaintext would produce ciphertext above the server ceiling
- **THEN** save is blocked with a clear size error

### Requirement: Unsaved change guard

While the editor has unsaved changes, browser close and in-app navigation SHALL require confirmation. A successful save MUST clear the dirty state before leaving the editor.

#### Scenario: In-app navigation
- **WHEN** the user follows a link while the editor is dirty
- **THEN** a confirmation is shown before the route changes

#### Scenario: Browser close
- **WHEN** the user closes or reloads the tab while the editor is dirty
- **THEN** the browser shows its leave-page confirmation

#### Scenario: Saved editor
- **WHEN** the user saves successfully and then navigates
- **THEN** no confirmation is shown

### Requirement: Editor conflict resolution

A revision conflict on save SHALL NOT silently overwrite the server row. The editor MUST offer reload of the current server item or saving the local values as a new item.

#### Scenario: Stale update
- **WHEN** an update returns 409
- **THEN** the editor shows reload and save-as-copy choices

#### Scenario: Reload choice
- **WHEN** the user chooses reload
- **THEN** the current server item is decrypted and replaces the editor values

#### Scenario: Save-as-copy choice
- **WHEN** the user chooses save-as-copy
- **THEN** a new item id is used and the original server row is unchanged

### Requirement: Trash from the editor

Deleting from the editor SHALL soft-delete the item through the outbox, update the cache, and return to the list. The list MUST offer an undo action that queues a restore before the toast expires.

#### Scenario: Delete from editor
- **WHEN** the user confirms delete in an editor
- **THEN** an `item.trash` entry is queued and the item leaves the live list

#### Scenario: Undo delete
- **WHEN** the user selects undo in the toast
- **THEN** an `item.restore` entry is queued and the item returns to the live list

#### Scenario: Undo after reload
- **WHEN** a delete was queued but not flushed and the app reloads before undo
- **THEN** the delete remains recoverable until trash retention ends

## MODIFIED Requirements

### Requirement: Minimal encrypted item creation

The list SHALL offer a create action that opens the full item editor. The client MUST NOT queue an item until the editor submits a valid payload. Creation MUST encrypt with the in-memory vault key, write an optimistic cache row and outbox entry, and refresh the list. The outbox MUST send standard-base64 cache ciphertext as base64url at the HTTP boundary.

#### Scenario: Create from empty state
- **WHEN** the user selects the empty-state create action
- **THEN** the create editor opens with no item queued

#### Scenario: Create from the toolbar
- **WHEN** the user selects the new-item action in the toolbar
- **THEN** the create editor opens with no item queued

#### Scenario: Offline create
- **WHEN** a valid creation is submitted offline
- **THEN** it remains in the outbox and appears after reload

#### Scenario: Transport encoding
- **WHEN** the outbox sends item or folder ciphertext
- **THEN** standard-base64 cache values become valid base64url request fields

#### Scenario: Invalid name
- **WHEN** the name is empty or over the limit
- **THEN** the editor shows an inline error and does not enqueue
