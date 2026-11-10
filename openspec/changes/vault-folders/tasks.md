# Tasks

## 1. Schema and folder queries

- [x] 1.1 Add `migrations/0013_folder_tombstones.sql` with nullable `folders.deleted_at` and an active-folder index; verify the migration applies and existing folders read as active.
- [x] 1.2 Extend folder row/query types with `deleted_at`, add active-only ownership lookup, any-state lookup for idempotent delete, list-active query, create insert, guarded rename, and the delete/detach batch; verify query tests cover each statement.
- [x] 1.3 Extend `createVaultQueries(env)` with folder list, create, rename, and delete operations; verify use cases do not call `prepare()` or `bind()`.

## 2. Folder use cases

- [x] 2.1 Implement list and create use cases with strict ciphertext fields and global rev allocation; verify create returns a rev greater than the previous server revision and list hides tombstones.
- [x] 2.2 Implement rename with optimistic `rev`; verify success, 409 with current folder, 404 for deleted/foreign, and no rev on failure.
- [x] 2.3 Implement soft delete with the folder tombstone and item detach in one batch; verify all detached items share the tombstone rev and a repeat delete returns the tombstone without a rev bump.
- [x] 2.4 Update item create/update folder checks to reject deleted folders; verify a deleted folder returns 404 and no item write occurs.

## 3. Sync and transport

- [x] 3.1 Add `deletedAt` to folder row, sync delta, response, and transport mapping; verify folder tombstones appear in sync and active folder mapping keeps ciphertext names.
- [x] 3.2 Verify an item detached by folder deletion appears in the same delta with `folderId: null` and the shared rev.
- [x] 3.3 Verify sync never returns another user's folder tombstone.

## 4. Routes and validation

- [x] 4.1 Add strict folder input schemas for `nameCt`, `nameIv`, `dataVersion`, and rename `rev`; verify malformed base64url, 64KB+ names, IV length, unknown fields, and user_id return 400.
- [x] 4.2 Add `GET /api/folders` and `POST /api/folders` as transport-only routes; verify 200 list, 201 create, 401, 400, 413, and no-store.
- [x] 4.3 Add `PATCH /api/folders/:id` with 200, 409 current row, 404, 401, 405, and no-store; verify Origin and IP rate limits.
- [x] 4.4 Add `DELETE /api/folders/:id` with origin-only mutation checks; verify 200 tombstone, idempotent repeat, 404, 401, 405, and no-store.
- [x] 4.5 Register all folder routes in `app/routes.ts`; verify route modules contain no SQL or business rules.

## 5. Tests and documentation

- [x] 5.1 Add use-case tests for folder CRUD, cross-user 404, stale rev, tombstone sync, detach-with-shared-rev, and deleted-folder item rejection.
- [x] 5.2 Add route tests for folder list/create/rename/delete, foreign origin, unauthenticated requests, malformed bodies, and oversized payloads.
- [x] 5.3 Document folder CRUD, tombstone behavior, and detach-on-delete in `README.md`; verify no plaintext names or ciphertext appear in examples.
- [x] 5.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm exec openspec validate vault-folders --strict`; verify all pass.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
- Folder tombstone retention is deferred until a device-aware cleanup policy exists.
