# Proposal

## Why

The cache stores wrapped key material, but the app has no lock lifecycle: the in-memory vault key is only set during login, the shell's lock button is disabled, and a reload with a valid session cannot distinguish locked from unlocked. This change adds local unlock, manual lock, and a locked shell overlay so the vault key can be discarded without losing ciphertext or the session.

Requirement: `TASK-37`.

## What Changes

- Enhance the in-memory key store with subscribe/snapshot support for lock state.
- Add `lockVault()` and `unlockVault(password)` using cached wrapped key/KDF material; unlock derives and unwraps locally without a server call.
- Treat authenticated SSR/initial client state as locked until hydration confirms an in-memory key.
- Add a global locked overlay with password entry, busy/error states, and sign-out.
- Enable the shell's lock action on every authenticated route.
- Keep IndexedDB ciphertext and wrapped-key material across lock; clear only the in-memory key and future decrypted selector state.
- If cached key material is missing/expired, the overlay offers sign-out/login rather than pretending to unlock.
- Count failed local unlock attempts per tab and force sign-out plus wipe on the fifth.
- Leave idle timeout, auto-lock settings, and visibility locking to TASK-28.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-client`: add key-lifetime state, local unlock, manual lock, and locked overlay behavior.
- `app-shell`: add the locked-state overlay and enable the lock action for authenticated users.

## Impact

- `app/lib/vault/key-store.ts` subscribers/snapshot.
- New `app/lib/vault/lock.ts` and lock overlay component.
- App shell lock action and overlay mount.
- Tests for lock/unlock, no-network unlock, navigation persistence, SSR locked state, and storage inspection.
- No server API, migration, cache-schema, timer, or auto-lock setting changes.
