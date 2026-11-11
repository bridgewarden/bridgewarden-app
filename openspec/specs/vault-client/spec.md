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
