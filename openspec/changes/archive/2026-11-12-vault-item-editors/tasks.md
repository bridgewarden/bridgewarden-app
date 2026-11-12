# Tasks

## 1. Payload and ciphertext limits

- [x] 1.1 Add shared vault item limits for name 256, username 256, password 1024, 10 URLs, 20 custom fields, 50KB UTF-8 note body, 80KB ciphertext, and 120,000-character base64url field; update `item-payload.ts` to enforce them and verify with unit tests for max and oversized values.
- [x] 1.2 Raise `app/server/vault/input.ts` to the shared 80KB ciphertext cap and field limit, keep the 256KB request cap, and verify valid 50KB-note ciphertext is accepted while 80KB-plus is rejected.
- [x] 1.3 Add a post-seal base64 length check to the editor save path so a payload that exceeds the server ceiling fails before enqueue; verify with a unit test that no outbox entry is written.

## 2. Full item read

- [x] 2.1 Add `readVaultItem(id)` in the vault layer to read one cached row, decrypt its envelope, validate the login or note payload, return payload plus metadata, and zero its key copy; verify with tests for login, note, corrupt ciphertext, missing row, and locked vault.
- [x] 2.2 Add a test proving the full reader returns password, TOTP secret, and custom fields while `readVaultProjection` remains reduced.

## 3. Editor shell and routing

- [x] 3.1 Add the protected `app/items/:itemId` route and `features/vault-item/` entry with `index.ts`, page container, components, hooks, types, and feature-suffixed helpers; verify the route renders create mode for `new` and edit mode for an existing id.
- [x] 3.2 Add editor copy to the i18n catalog for labels, validation, save, delete, conflict, and dirty-guard messages; verify every new key resolves through `t()`.
- [x] 3.3 Mount editor state only while unlocked and unmount it on lock; verify no editor fields render in SSR HTML.

## 4. Login editor

- [x] 4.1 Build the login fields for name, username, password, multiple URLs, notes, folder, favorite, TOTP secret, and a custom-field repeater with label/value/hidden; verify each field round-trips through form state.
- [x] 4.2 Add password reveal and TOTP-secret format validation without adding copy or generate actions; verify invalid secrets block save with an inline error.
- [x] 4.3 Add required-name and field-limit validation with inline messages; verify no queue entry is created for invalid input.

## 5. Secure note editor

- [x] 5.1 Build the note fields for name, multiline body, folder, and favorite with a UTF-8 byte counter; verify a 50KB body is accepted and a larger body is blocked client-side with a clear message.

## 6. Save, update, and conflict

- [x] 6.1 Wire create save to validate, seal, build a client UUID optimistic row, enqueue `item.create`, refresh the list, and flush; verify a create appears immediately and after reload.
- [x] 6.2 Wire update save to use the cached row's current `rev`, enqueue `item.update`, and refresh; verify the server row advances and the editor reflects decrypted server values.
- [x] 6.3 Subscribe to outbox events for the edited item and implement reload and save-as-copy on 409; verify a stale update never overwrites the server row and both choices produce the expected result.
- [x] 6.4 Verify D1 contains no plaintext name, username, password, note body, TOTP secret, or custom-field value after login and note saves.

## 7. Dirty guard, delete, and undo

- [x] 7.1 Add a dirty snapshot, React Router blocker confirmation, and `beforeunload` handler; verify navigation and tab close prompt only while dirty and never after a successful save.
- [x] 7.2 Add delete from the editor through `item.trash`, navigate to the list, and show an undo toast that queues `item.restore`; verify delete and undo both survive a reload when still queued.
- [x] 7.3 Add an edit action to the list detail dialog and replace the minimal create dialog with navigation to the create editor; verify empty-state and toolbar create actions open the editor without queueing an item.

## 8. End-to-end coverage

- [x] 8.1 Add Playwright coverage for login create/edit/reload, secure note 50KB create/edit/reload, oversized note rejection, unsaved-navigation confirmation, delete plus undo, and conflict reload/save-as-copy; verify every flow against the real Worker and D1.
- [x] 8.2 Add a Playwright assertion that queries local D1 after saves and finds no plaintext secret or body values.
- [x] 8.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`; verify all pass and `build/server/.dev.vars` is absent.

## Workflow follow-up

- Update `.agent/tasks/TASK-15.json`, `.agent/tasks.json`, and the PRD status after review if the project expects those mirrors to reflect completion.
- Archive the change after the project's review requirements are satisfied.
