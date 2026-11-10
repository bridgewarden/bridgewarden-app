# Tasks

## 1. Vault query layer and revision allocator

- [x] 1.1 Add `app/server/vault/queries/rev.ts` with a guarded revision increment and a server-revision read; verify a D1 test shows `vault_rev` increases by one per allocation.
- [x] 1.2 Add item and folder query modules with owned item lookup, owned folder lookup, create insert, and guarded update; verify query tests read back ciphertext columns and return null for foreign ids.
- [x] 1.3 Add opaque cursor encode/decode helpers for `rev:id`; verify malformed, negative, and non-integer cursors are rejected without SQL execution.

## 2. Incremental sync

- [x] 2.1 Implement the ordered union delta query across items and folders with `rev > since`, a cursor tie-breaker, tombstones included, and `LIMIT 501`; verify a query test covers 500-row truncation, resumption, and an empty delta.
- [x] 2.2 Map rows to the API response with base64url ciphertext/IV values and no plaintext fields; verify a response test contains only ids, ciphertext, IVs, metadata, timestamps, and revs.
- [x] 2.3 Add `GET /api/vault` as a transport-only loader using `requireUserApi`, validating non-negative `since` and cursor input; verify unauthenticated requests return 401 and malformed input returns 400.
- [x] 2.4 Verify sync returns only the session user's rows when two users have items and folders.

## 3. Item creation

- [x] 3.1 Add strict create schemas for type, folder id, favorite, ciphertext, IV, and data version; verify malformed base64url, IV length, type, and unknown fields return 400.
- [x] 3.2 Implement the create use case with a folder ownership check and one D1 batch containing the revision increment plus insert-select; verify the created row has a rev greater than the previous server revision.
- [x] 3.3 Verify a failing insert rolls back the revision increment by injecting a constraint failure in a query test.
- [x] 3.4 Add `POST /api/vault/items` with Origin and body-size enforcement; verify 201 with the created row, 404 for a foreign folder, and 413 for an oversized body.

## 4. Item update

- [x] 4.1 Implement the update use case with a full encrypted payload plus `rev`, a guarded `WHERE id AND user_id AND rev` update, and a current-row fetch when zero rows change; verify a stale rev returns 409 without overwriting.
- [x] 4.2 Verify unknown and foreign item ids return 404 and do not reveal another user's row.
- [x] 4.3 Add `PATCH /api/vault/items/:id` as a transport-only action; verify 200 with the updated row, 409 with the current row, 404, and 400 validation responses.
- [x] 4.4 Verify a successful update advances rev and appears in the next sync delta.

## 5. Authorization and payload limits

- [x] 5.1 Add a test that posts `user_id` in an item body and confirms strict validation rejects it while the session user remains authoritative.
- [x] 5.2 Add cross-user read/update tests for items and folder references; verify every case returns 404.
- [x] 5.3 Verify a body over 256KB returns 413 and that validation failures do not write raw payloads to logs.
- [x] 5.4 Verify ciphertext over 64KB and IVs other than 12 bytes return 400.

## 6. Documentation and verification

- [x] 6.1 Document the sync, create, and update contracts, cursor behavior, and revision semantics in `README.md`; verify no plaintext example or secret appears.
- [x] 6.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and `pnpm exec openspec validate vault-sync-items --strict`; verify all pass.
- [x] 6.3 Confirm the routes are registered in `app/routes.ts` and the route modules contain no SQL or business rules.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
- Defer `vault-trash-purge` and `vault-folders` to their own changes.
