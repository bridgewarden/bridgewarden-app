# Tasks

## 1. Idempotent create API

- [x] 1.1 Extend the item create schema with optional UUID `id`; verify malformed UUID, unknown fields, and existing validation still return 400.
- [x] 1.2 Add the id to the rev guard and insert-select statements so a replay does not consume a revision and uses the client id; verify query tests for new id, duplicate owned id, and foreign-id collision.
- [x] 1.3 Update the create use case and route to return 201 for a new row, 200 for an owned replay, and a generic 409 for a foreign collision; verify no foreign row is exposed.
- [x] 1.4 Verify failed insert rollback, folder ownership, and revision advance still hold.

## 2. Outbox schema

- [x] 2.1 Bump the local database to version 2 and create the `outbox` store with auto-increment key; verify upgrading a version-1 database preserves items/folders/keys/sync and adds only `outbox`.
- [x] 2.2 Add outbox operation types and payload types covering item create/update/trash/restore/purge and folder create/rename/delete; verify encrypted payloads and previous/optimistic snapshots are stored.
- [x] 2.3 Add transactional optimistic/rollback writes inside the outbox module; verify cache rows remain ciphertext-only.
- [x] 2.4 Verify `wipeVaultDb()` removes outbox entries with all other stores.

## 3. Enqueue and flush

- [x] 3.1 Implement transactional `enqueue(op)` that writes the optimistic cache row and outbox entry atomically; verify an aborted transaction leaves neither.
- [x] 3.2 Implement single-flight `flush()` in FIFO order; verify in-order requests and that a successful entry is removed and its cached row replaced with the server response.
- [x] 3.3 Verify a network or 5xx failure stops the flush, keeps the failed entry and later entries, and sends no further request.
- [x] 3.4 Verify a 409 rolls back the optimistic row, removes the entry, starts a refetch, and emits a conflict event.
- [x] 3.5 Verify 400 removes and reports the entry without an infinite retry; 404 rolls back and triggers a refetch.
- [x] 3.6 Verify an ambiguous create retry with the same id results in a single server item and a 200 replay handling path.

## 4. Cache integration

- [x] 4.1 Verify flush success and rollback write cache rows inside their outbox transaction and never import decryption.
- [x] 4.2 Verify sync and outbox can run without overwriting each other's rows incorrectly; a server row from flush is visible in a later cache read.
- [x] 4.3 Verify account switch/logout cannot retain outbox entries or optimistic rows.

## 5. Tests and documentation

- [x] 5.1 Add fake-indexeddb outbox tests for enqueue/reopen, FIFO, stop-on-failure, conflict rollback, 400/404 outcomes, and duplicate create replay.
- [x] 5.2 Add API tests for client-id create, owned replay 200/no rev, foreign collision 409, malformed UUID 400, and existing folder/rev behavior.
- [x] 5.3 Document outbox behavior, idempotent create, conflict semantics, and deferred editor UI in `README.md`; verify no plaintext examples.
- [x] 5.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm exec openspec validate vault-outbox --strict`; verify all pass.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
- Editor UI remains TASK-40/41; key lifetime and auto-lock remain separate.
