# Tasks

## 1. Trash data

- [x] 1.1 Add a trash projection that decrypts cached tombstones with non-empty ciphertext, joins folder labels, and skips corrupt/purged rows; verify unit tests for deleted, purged, corrupt, and missing-folder rows.
- [x] 1.2 Add a metadata-only trash count store that refreshes on sync/outbox/key/wipe events; verify count tests for restorable vs purged tombstones and sign-out reset.

## 2. Trash UI and mutations

- [x] 2.1 Replace the placeholder feature with a trash page entry, hook, list rows, loading/empty states, and `/app/trash` transport route; verify list rendering and keyboard reachability.
- [x] 2.2 Add restore through `item.restore`, optimistic cache, folder retention, and refresh; verify success, failure rollback, and folder return tests.
- [x] 2.3 Add purge through `item.purge` with confirmation: exact-name input when count > 5, destructive confirm otherwise, disabled until valid; verify no mutation on cancel and irreversible removal on confirm.
- [x] 2.4 Add Playwright coverage for delete → trash → restore, purge confirmation, purge removal, and empty trash; verify trash state remains inside the locked boundary.

## 3. Shared states and offline

- [x] 3.1 Add shared `EmptyState`, `SkeletonList`, `InlineError`, and `ErrorToast` components with catalog-backed props and accessible actions; verify component behavior with unit/render tests where applicable.
- [x] 3.2 Adopt the shared components in vault list, editor, trash, generator, and settings, removing duplicate ad-hoc states; verify each surface still shows loading, empty, and error states.
- [x] 3.3 Add an online-status hook and global `OfflineBanner`; remove the duplicate list-local offline alert; verify cached items remain visible while offline and the banner clears on `online`.

## 4. Error boundary and server logging

- [x] 4.1 Update the root error boundary for catalog copy, retry/safe navigation, optional request id, and production stack redaction; verify 404, route error, and production rendering tests.
- [x] 4.2 Add Worker request-error logging with a generated request id and method/path/error class only; verify no body, plaintext, token, ciphertext, or stack reaches HTML.
- [x] 4.3 Add Playwright coverage for a simulated 500 and offline network loss; verify generic copy with retry, offline banner, cached data, and no unhandled rejection.

## 5. Responsive header and editor

- [x] 5.1 Add a compact header menu for secondary account actions at mobile widths, expose trash/settings/admin/sign-out access, and keep trash count visible; verify keyboard and 44px targets.
- [x] 5.2 Make the item editor a full-screen surface below the mobile breakpoint without fixed height; verify back/save actions and focused fields remain reachable with the keyboard open.
- [x] 5.3 Audit list, editor, trash, generator, login, and settings at 360px/768px; fix horizontal overflow, hidden metadata, and undersized touch targets.

## 6. Integration verification

- [x] 6.1 Add Playwright viewport projects for 360px and 768px covering login, list, editor, trash, and generator; assert `scrollWidth <= clientWidth` and required actions without writing authenticated screenshot artifacts.
- [x] 6.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`; verify all pass and `build/server/.dev.vars` is absent.

## Workflow follow-up

- Update `.agent/tasks/TASK-17.json`, `.agent/tasks.json`, and the PRD status after review if the project expects those mirrors to reflect completion.
- Archive the change after the project's review requirements are satisfied.
