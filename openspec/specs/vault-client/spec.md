# vault-client Specification

## Purpose
Defines the browser-side ciphertext cache, wrapped-key persistence, resumable vault sync, and local-data wipe contract used by later vault UI, unlock, and offline work.

## Requirements

### Requirement: Ciphertext-only local cache

The browser SHALL cache vault items and folders in IndexedDB using only ciphertext, IVs, identifiers, and metadata returned by the vault API. It MUST NOT persist plaintext item fields, the unwrapped vault key, or decrypted selector output.

#### Scenario: Items cached as ciphertext
- **WHEN** a sync applies item and folder rows
- **THEN** IndexedDB contains ciphertext and metadata only, with no plaintext item or folder names

#### Scenario: Vault key not persisted
- **WHEN** IndexedDB is inspected after unlock and sync
- **THEN** no unwrapped vault key exists in any store

### Requirement: Wrapped key material persistence

Successful login, setup, member setup, recovery, and master-password rotation SHALL persist the active account's wrapped vault key, wrapping IV, KDF salt, and iteration count for local unlock. The cache MUST store only public parameters and wrapped key material, never the password or master key.

#### Scenario: Login stores key material
- **WHEN** login or 2FA completes and the vault key is unwrapped
- **THEN** wrapped key material and KDF parameters are stored for the active account

#### Scenario: Password rotation updates cache
- **WHEN** the master password is rotated
- **THEN** the cached wrapper and KDF parameters are replaced with the new values

#### Scenario: New account replaces prior cache
- **WHEN** a different account signs in
- **THEN** the previous account's cached data is wiped before the new key material is stored

### Requirement: Resumable vault sync

The sync engine SHALL read the stored watermark and cursor, call `GET /api/vault`, apply items, folders, and tombstones to the cache, update the watermark/cursor, and repeat while `nextCursor` is present. It MUST skip network work when offline, retain the last successful watermark on failure, and expose a status observable for the UI.

#### Scenario: Initial sync
- **WHEN** the cache has no watermark and the browser is online
- **THEN** all pages are fetched and applied and the final watermark is stored

#### Scenario: Truncated page resumes
- **WHEN** a response contains `nextCursor`
- **THEN** the engine fetches the next page with the same cursor contract until none remains

#### Scenario: Offline sync
- **WHEN** the browser reports offline
- **THEN** no request is made and cached data remains readable

#### Scenario: Failed sync
- **WHEN** a request fails
- **THEN** the previous watermark and cache are retained and the status reports the failure

#### Scenario: Tombstone applied
- **WHEN** a delta contains a deleted item or folder
- **THEN** the cached row is replaced with its tombstone state

### Requirement: Logout and account wipe

Logout and account switch SHALL clear the in-memory vault key and delete every cache store, including wrapped key material, sync state, items, folders, and metadata.

#### Scenario: Logout wipes cache
- **WHEN** the user signs out
- **THEN** IndexedDB stores are empty and the in-memory key is gone

#### Scenario: Account switch wipes cache
- **WHEN** a different account authenticates
- **THEN** the prior account's stores are removed before new data is written

### Requirement: Degraded mode

When IndexedDB is unavailable, the client SHALL continue in online-only mode, MUST NOT lose the in-memory session, and MUST expose a status flag so the UI can explain that caching is unavailable.

#### Scenario: IndexedDB unavailable
- **WHEN** opening the database fails or the API is absent
- **THEN** the app continues online without cache and reports degraded mode

#### Scenario: No silent plaintext fallback
- **WHEN** IndexedDB is unavailable
- **THEN** the client MUST NOT fall back to localStorage, sessionStorage, or plaintext persistence

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

### Requirement: In-memory vault key lifetime

The unwrapped vault key SHALL live only in module-scoped memory. The client SHALL expose lock state through a subscription/snapshot interface, and `lock()` SHALL zero the key, clear future decrypted selector state, and retain IndexedDB ciphertext, wrapped-key material, and the server session.

#### Scenario: Manual lock
- **WHEN** an unlocked user invokes lock
- **THEN** the in-memory key is gone, the app is locked, and ciphertext/cache/session remain

#### Scenario: Key is not in storage
- **WHEN** localStorage, sessionStorage, and IndexedDB are inspected after unlock
- **THEN** no unwrapped vault key is present

#### Scenario: Navigation does not re-prompt
- **WHEN** an unlocked user navigates between vault routes
- **THEN** the key remains in memory and no password prompt appears

### Requirement: Local unlock without server round-trip

`unlock(password)` SHALL read the active wrapped key material from IndexedDB, derive the master/wrap key, unwrap the vault key, and set it in memory. It MUST work while the page is loaded without a network request. A wrong password MUST leave the app locked with a generic error.

#### Scenario: Correct password
- **WHEN** the user enters the correct master password while locked
- **THEN** the cached wrapper is unwrapped locally and the app unlocks

#### Scenario: Wrong password
- **WHEN** the user enters a wrong password
- **THEN** the app stays locked and no key is stored

#### Scenario: No cached material
- **WHEN** wrapped key material is missing or expired
- **THEN** local unlock is unavailable and the overlay offers sign-out/login

### Requirement: Five failed unlocks force sign-out

The client SHALL count consecutive invalid local unlock attempts per tab. On the fifth failure it MUST lock the key, stop accepting passwords, and force the full sign-out flow, which revokes the session and wipes local vault data. A successful unlock or completed sign-out clears the counter.

#### Scenario: Fifth wrong password
- **WHEN** the user enters five wrong master passwords in a row
- **THEN** the app signs out, revokes the session, and wipes local vault data

#### Scenario: Correct password after lockout
- **WHEN** the counter already reached five and the user submits the correct password
- **THEN** the app still signs out instead of unlocking

### Requirement: Reload starts locked

An authenticated document render with no in-memory key SHALL be treated as locked. The server/initial snapshot MUST NOT present unlocked vault content before hydration confirms the key.

#### Scenario: Reload authenticated app
- **WHEN** the browser reloads `/app` with a valid session
- **THEN** the shell renders locked until local unlock succeeds

### Requirement: Configurable idle auto-lock

The client SHALL support an idle timeout of 1, 5, 15, 30, or 60 minutes, or never. The default MUST be 15 minutes. A timeout expiration SHALL call `lockVault()`, retaining IndexedDB ciphertext, wrapped key material, and the server session.

#### Scenario: Timeout expires
- **WHEN** the vault is unlocked and no qualifying activity occurs for the configured duration
- **THEN** the vault locks and the overlay requires the master password

#### Scenario: Activity resets the deadline
- **WHEN** the user produces pointer, keyboard, touch, or scroll activity before the deadline
- **THEN** the timeout restarts from that activity

#### Scenario: Never times out
- **WHEN** the configured value is `never`
- **THEN** no idle timer locks the vault, while manual lock remains available

#### Scenario: Invalid preference
- **WHEN** stored preference data is missing or invalid
- **THEN** the client uses 15 minutes

### Requirement: Optional lock on tab hide

The client SHALL provide a default-off preference to lock when the document becomes hidden. When enabled, hiding the tab MUST lock immediately. When disabled, the idle deadline continues to apply.

#### Scenario: Hide lock enabled
- **WHEN** the document becomes hidden and the preference is enabled
- **THEN** the vault locks immediately

#### Scenario: Hide lock disabled
- **WHEN** the document becomes hidden and the preference is disabled
- **THEN** the vault stays unlocked until the idle deadline or manual lock

#### Scenario: Return after the deadline
- **WHEN** the document becomes visible after the idle deadline passed
- **THEN** the vault locks before the unlocked UI is shown

### Requirement: Lock propagation across tabs

A manual or automatic lock in one tab SHALL clear the in-memory key in sibling tabs of the same browser profile. A locked sibling on a protected route MUST show the locked overlay.

#### Scenario: Sibling tab locks
- **WHEN** one unlocked tab locks
- **THEN** another unlocked tab in the same browser profile clears its key and requires the master password

### Requirement: Non-sensitive preference storage

Auto-lock preferences SHALL be stored outside the vault key path and MUST NOT contain plaintext, wrapped keys, the master password, or tokens. The preference SHALL persist across reloads on the device.

#### Scenario: Preference resets for a new session
- **WHEN** the user signs out or authenticates after an unauthenticated visit
- **THEN** the policy returns to 15 minutes and hide-lock off

#### Scenario: Preference persists
- **WHEN** the user selects 30 minutes and reloads
- **THEN** the setting still reads 30 minutes

#### Scenario: No secrets in preference storage
- **WHEN** preference storage is inspected
- **THEN** it contains only the timeout and tab-hide values

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

### Requirement: Vault-key copy zeroization

Key existence checks SHALL NOT return an unzeroed key copy. Every consumer that needs key bytes SHALL take an owned copy and wipe it, and replacing the active key SHALL wipe the previous buffer.

#### Scenario: Existence check
- **WHEN** sync or outbox checks whether a vault key exists
- **THEN** no key buffer is allocated or the allocated buffer is not exposed

#### Scenario: Key replacement
- **WHEN** unlock or setup replaces the active key
- **THEN** the previous buffer is zeroed before reassignment

### Requirement: Outbox ciphertext validation at every boundary

The outbox SHALL validate a strict ciphertext schema for payloads, optimistic/previous rows, and persisted entries at enqueue and immediately before transport. A plaintext-shaped or unknown field MUST fail closed.

#### Scenario: Flush-time tamper
- **WHEN** a persisted outbox entry contains a plaintext field
- **THEN** the flush fails without sending it and records an error

#### Scenario: Optimistic row
- **WHEN** a create includes an optimistic ciphertext row
- **THEN** that row is validated before it is written to IndexedDB

### Requirement: Logout wipes local state on failure

Sign-out SHALL clear the in-memory key and wipe local vault state even when the server logout request fails. The UI MAY report the server error but MUST NOT leave decrypted-capable local state resident.

#### Scenario: Server logout fails
- **WHEN** the logout action returns an error or the request fails
- **THEN** the vault key is cleared and IndexedDB is wiped

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
