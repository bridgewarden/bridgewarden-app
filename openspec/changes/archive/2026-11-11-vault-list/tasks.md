# Tasks

## 1. Payload and projection

- [x] 1.1 Add strict login/note/folder payload schemas and view types in `item-payload.ts`.
- [x] 1.2 Add standard-base64 to base64url normalization for outbox item/folder request bodies; verify cache values stay standard base64.
- [x] 1.3 Add `projection.ts`: read cache, decrypt folders first, decrypt items with concurrency 8, validate payloads, skip corrupt rows, zero the key copy.
- [x] 1.4 Add tests for valid login/note payloads, type mismatch, corrupt ciphertext, invalid folder, tombstones, and skipped counts.
- [x] 1.5 Add a 500-row projection/sort/filter test and verify no unbounded promise fan-out.

## 2. List state and view

- [x] 2.1 Add pure sort/filter helpers for name/updated, type, folder, and favorite; verify combined predicates.
- [x] 2.2 Add `useVaultList` to sync then project, expose loading/error/offline state, and refresh on outbox events.
- [x] 2.3 Build the list container with rows showing name, username, folder, favorite, and type.
- [x] 2.4 Add toolbar controls for sort, type, folder, and favorite; preserve shadcn Native Select/Select usage.
- [x] 2.5 Add empty state with a create CTA, loading skeleton, and non-blocking sync/error status.
- [x] 2.6 Add keyboard `j/k`, ArrowUp/ArrowDown, Enter, ignore form targets, and scroll the active row into view.
- [x] 2.7 Add a read-only detail dialog with name, type, folder, favorite, username, URLs, and notes/body; never render password or TOTP secret.

## 3. Minimal create

- [x] 3.1 Add a Dialog with name, type, folder, and favorite; validate name inline.
- [x] 3.2 Encrypt the minimal payload with the vault key, build the optimistic cache row, enqueue the create, refresh the list, and flush.
- [x] 3.3 Verify offline create remains queued and appears after reload, and online create is replaced by the server row.
- [x] 3.4 Verify item and folder ciphertext is base64url in HTTP bodies and standard base64 in cache.

## 4. E2E and docs

- [x] 4.1 Add a Playwright `vault-list` project after auth and a flow: empty CTA → create login → filter → Enter detail → lock → unlock → item still listed.
- [x] 4.2 Verify a secure note can be created and opens without a username.
- [x] 4.3 Verify 360px layout has no horizontal overflow and filters remain usable.
- [x] 4.4 Document the list, filters, keyboard, minimal create, and deferred search/editor work in `README.md`.
- [x] 4.5 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm exec openspec validate vault-list --strict`.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
- Defer search and Ctrl/Cmd+K to TASK-39; defer full fields, update/delete, and unsaved guard to TASK-40/41.
