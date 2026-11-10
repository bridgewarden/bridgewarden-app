# Spec Delta

## Purpose

Defines the browser-side ciphertext cache, wrapped-key persistence, resumable vault sync, and local-data wipe contract used by later vault UI, unlock, and offline work.

## ADDED Requirements

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
