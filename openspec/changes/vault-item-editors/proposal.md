# Proposal

## Why

The vault list can only create a minimal named item and shows a read-only detail dialog. Users cannot enter credentials, notes, URLs, custom fields, or TOTP secrets, and a 50KB secure note is rejected by the current 64KB ciphertext cap. TASK-15 closes the create/edit/delete gap for login items and secure notes.

## What Changes

- Add protected item editor routes for create and edit: `/app/items/new` and `/app/items/:id`.
- Replace the list's minimal create dialog with the full editor while keeping the empty-state create action.
- Add login fields: name, username, password, multiple URLs, notes, folder, favorite, TOTP secret, and custom fields with a hidden toggle.
- Add secure-note fields: name, multiline body, folder, and favorite, with a 50KB limit and a clear oversized-body error.
- Decrypt the full cached payload for editing; the list projection remains a reduced view.
- Save creates and updates through the encrypted outbox, then refresh the list.
- Add a dirty guard for in-app navigation and browser close.
- Add conflict handling that offers reload or save-as-copy instead of silent overwrite.
- Add delete-to-trash from the editor with an undo action that queues restore.
- Align plaintext schema limits with TASK-15: name 256, username 256, 10 URLs, 20 custom fields.
- Raise the server ciphertext ceiling so a 50KB note plus envelope and base64 expansion can be stored.
- Exclude password/TOTP generation, trash page work, responsive polish, and attachments.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-client`: full item editor behavior, full-payload decryption for editing, dirty guard, conflict resolution, delete/undo, and revised plaintext limits.
- `vault-api`: ciphertext size ceiling must accept the maximum valid encrypted item, including a 50KB note.

## Impact

- New `app/features/vault-item/` feature, route entry, and editor components.
- `app/lib/vault/item-payload.ts`, `projection.ts`, and a new full-item read path.
- `app/lib/vault/outbox.ts` consumers for create/update/trash/restore.
- `app/features/vault-list/` create entry and edit action.
- `app/server/vault/input.ts` ciphertext and field-size limits.
- `app/routes.ts`, i18n copy, unit tests, and Playwright editor coverage.
- No new runtime dependency; dirty tracking uses local state plus React Router's blocker.
