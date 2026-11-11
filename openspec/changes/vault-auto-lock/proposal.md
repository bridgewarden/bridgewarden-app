# Proposal

## Why

`vault-key-lifetime` added manual lock, local unlock, and five-failure logout, but an unattended unlocked vault never locks by itself. This change adds the configurable idle policy from TASK-28 and an optional tab-hide lock while keeping ciphertext, wrapped key material, and the session intact.

Requirement: `TASK-28`.

## What Changes

- Add a non-sensitive client preference store for idle timeout and lock-on-tab-hide.
- Idle timeout options: 1, 5, 15, 30, 60 minutes, or never; default 15 minutes.
- Reset the idle timer on pointer, keyboard, touch, and scroll activity.
- Lock when the timeout elapses and show the existing overlay.
- Add an optional, default-off lock on tab hide.
- On tab return, lock immediately if the idle deadline already passed.
- Add an account-settings card for both preferences.
- Keep manual lock, local unlock, five-failure logout, cache, and session behavior unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-client`: add idle timeout preferences, activity reset, tab-hide policy, and auto-lock behavior.
- `app-shell`: add automatic locking and the settings surface for the policy.

## Impact

- New `app/lib/vault/auto-lock.ts` preference store and pure decision helpers.
- `AppShell` timer/activity/visibility wiring using `lockVault()`.
- Account-settings `AutoLockCard` plus i18n copy.
- Unit tests for parsing, persistence, expiry, and visibility decisions; E2E with fake time.
- No server API, database, migration, crypto, or cache-schema changes.
