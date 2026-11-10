# Tasks

## 1. Trash query layer

- [x] 1.1 Add conditional rev statements for soft delete and restore (`deleted_at IS NULL` / `IS NOT NULL`) plus item state updates with `RETURNING`; verify query tests show a state change increments rev once and a repeat does not.
- [x] 1.2 Add a purge statement conditional on the owner, `deleted_at IS NOT NULL`, and non-empty ciphertext; verify an active item is rejected and a deleted item is ciphertext-erased with a returned tombstone.
- [x] 1.3 Extend `createVaultQueries(env)` with the trash, restore, purge, and expired-purge operations; verify use cases do not call `prepare()` or `bind()` directly.

## 2. Trash use cases

- [x] 2.1 Implement `trashVaultItem` and `restoreVaultItem` returning `ok`, `not-found`, or `server-error`; verify idempotent repeats return the current row without a rev bump.
- [x] 2.2 Implement `purgeVaultItem` with a deleted-state guard and ciphertext erase; verify 404 for active/foreign/missing items, one rev on first purge, and no rev on repeat.
- [x] 2.3 Implement `purgeExpiredItems` with a 30-day cutoff, batch size 1000, and a safety cap; verify only expired tombstones are removed and the loop stops.

## 3. Routes

- [x] 3.1 Add an origin-only mutation guard to `app/lib/.server/json-action.ts`; verify foreign origins return 403 and same-origin requests proceed.
- [x] 3.2 Extend the item route action with `DELETE` for soft delete; verify 200, 404, 401, 405, foreign origin 403, and `no-store`.
- [x] 3.3 Add `POST /api/vault/items/:id/restore`; verify 200, idempotent repeat, 404, 401, and `no-store`.
- [x] 3.4 Add `POST /api/vault/items/:id/purge` with strict `{confirm:true}` validation; verify 200, 400 without confirmation, 404 for active/foreign, and `no-store`.
- [x] 3.5 Register the restore and purge routes in `app/routes.ts`; verify the route modules remain transport-only.

## 4. Scheduled purge

- [x] 4.1 Add `triggers.crons = ["0 3 * * *"]` to `wrangler.jsonc`; verify Wrangler configuration parses.
- [x] 4.2 Add the `scheduled` handler in `workers/app.ts` calling the purge use case; verify it logs only an event name and count.
- [x] 4.3 Verify the scheduled handler removes expired rows in multiple batches and leaves recent tombstones intact.

## 5. Tests and documentation

- [x] 5.1 Add route tests for delete/restore tombstone sync, purge, idempotency, cross-user 404, unauthenticated 401, unsupported method 405, and foreign origin 403.
- [x] 5.2 Add query/use-case tests for conditional rev allocation, repeated operations, purge guards, and cron cutoff/batching.
- [x] 5.3 Document delete/restore/purge and the 30-day cron in `README.md`; verify no ciphertext or ids appear in examples or logs.
- [x] 5.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm exec openspec validate vault-trash-purge --strict`; verify all pass.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
- Defer folder writes to `vault-folders`.
- Deviation: purge erases ciphertext but keeps a metadata tombstone so offline devices can sync the purge; call this out in the PR body.
