# Proposal

## Why

The app currently has no local vault state: every view depends on the server, reloads lose metadata, and there is no foundation for offline mutations, unlock, or auto-lock. This change adds the ciphertext-only IndexedDB cache, wrapped-key cache, and resumable sync engine that later client work depends on.

Requirement: `TASK-36` (cache and sync portion; outbox is a separate change).

## What Changes

- Add IndexedDB stores for items, folders, wrapped key material, sync state, and non-sensitive metadata.
- Cache only ciphertext and metadata; never plaintext item content or the unwrapped vault key.
- Add a sync engine that loops `GET /api/vault` with `since`/`nextCursor`, applies items, folders, and tombstones, and stores `serverRev` and cursor.
- Persist wrapped key material and KDF parameters after login, setup, member setup, recovery, and password rotation so a later unlock can derive the key locally.
- Wipe every store on logout and account switch; clear the in-memory key.
- Detect missing IndexedDB and fall back to online-only with a status flag.
- Expose cache/sync status as a small observable for future UI.
- Add `idb` and the `fake-indexeddb` test dependency.
- Do not add the outbox, conflict replay, lock provider, or auto-lock in this change.
- Do not claim offline reload; the app is SSR and needs the later PWA work before a network-free reload can load the document.

## Capabilities

### New Capabilities

- `vault-client`: ciphertext-only local cache, wrapped-key persistence, resumable sync, logout wipe, and degraded-mode behavior.

### Modified Capabilities

None.

## Impact

- New `app/lib/vault/` modules: local database, cache, sync engine, key material persistence, and status.
- Login/setup/member-setup/recovery/password-change hooks persist wrapped key material after success.
- Logout flow wipes local data.
- New tests with `fake-indexeddb`; no new UI.
- No server API or migration changes.
- Offline create, outbox, and offline reload remain future changes.
