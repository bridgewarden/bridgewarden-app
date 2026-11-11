# Proposal

## Why

The cache, sync engine, outbox, and lock lifecycle exist, but the vault still renders only a placeholder. There is no plaintext item contract, no decrypt selector, and no way to create the first item, so the empty screen cannot lead anywhere.

This change adds the first usable vault surface: decrypt cached ciphertext into validated item views, list/sort/filter them, create a minimal named item through the existing encrypted outbox, and open a read-only detail. Full login/note editors and search remain later changes.

Requirements: `TASK-38`; minimal create slice of `TASK-40`.

## What Changes

- Define validated plaintext payloads for login items, secure notes, and folder names.
- Add a decrypt selector that reads cached rows, skips tombstones/corrupt payloads, and returns item views plus folder names.
- Add list rows with name, username, folder, favorite, and type.
- Add sort by name/updated and combine type/folder/favorite filters.
- Add keyboard `j/k`/arrows and Enter; Enter opens a read-only detail dialog.
- Add an empty-state CTA that opens a minimal create dialog with name, type, folder, and favorite.
- Encrypt minimal creates with the vault key, enqueue them through the outbox, and refresh the list optimistically.
- Normalize cached standard base64 ciphertext to base64url at the outbox HTTP boundary.
- Keep search input, debounce, highlighting, and `Ctrl/Cmd+K` for TASK-39.
- Keep full editor fields, unsaved-change guard, delete, and update for TASK-40/41.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-client`: add plaintext payload validation, safe decrypt selectors, list/sort/filter, minimal encrypted create, and item detail.
- `vault-api`: no server contract changes; outbox transport normalization stays client-side.

## Impact

- New item/folder payload schema and decrypted view types.
- New vault-list hook, list, filters, detail dialog, and create dialog.
- Outbox request building converts standard base64 cache fields to transport base64url.
- List updates after sync, enqueue, and flush events.
- Unit tests for payload validation, corrupt rows, decrypt failure, sort/filter, and 500-row selector performance.
- E2E: create a named login item from the empty state, filter it, open it, lock, unlock, and see it again.
- No migration, server API, session, or crypto algorithm change.
