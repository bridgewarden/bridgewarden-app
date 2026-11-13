# Tasks

## 1. Folder lifecycle E2E

- [x] 1.1 Add `e2e/vault-folders.spec.ts` that creates two folders through the item editor, renames one through `PATCH /api/folders/:id` using the other folder's D1 ciphertext, deletes the second through `DELETE /api/folders/:id`, and verifies the decrypted filter projection after reload and unlock.
- [x] 1.2 Register a `vault-folders` Playwright project in `playwright.config.ts` with `dependencies: ['vault-item']` and the authenticated-project artifact settings.
- [x] 1.3 Verify `pnpm test:e2e --project=vault-folders` passes, the folder rows come only from `.wrangler/e2e`, and the deleted folder's item remains visible with no folder.

## 2. Audit evidence assertions

- [x] 2.1 Add `e2e/audit.ts` with `readAuditEvents` and `expectAuditEvent(rows, type, { userId, metadata })`; validate the full audit table, scope rows to the actor, and reject email, item names, ciphertext, passwords, tokens, TOTP codes, and recovery material.
- [x] 2.2 Add a final `audit` project and `e2e/audit.spec.ts` that assert `bootstrap.created`, login success/failure/logout, 2FA enrollment/verification/backup-code/failure/disable, admin invitation/role/session revoke/disable, member setup, `password.changed`, `recovery.completed`, and `item.purged` after the critical-flow projects complete.
- [x] 2.3 Verify the audit project passes and every asserted metadata value is null or an allowed identifier.

## 3. Sensitive artifact policy

- [x] 3.1 Add `e2e/README.md` documenting the local servers and D1 state, the unauthenticated-only trace/screenshot policy, why authenticated artifacts would capture plaintext or cookies, and the diagnostic alternatives.
- [x] 3.2 Verify every auth, 2FA, admin, recovery, and vault project in `playwright.config.ts` keeps `trace: 'off'` and `screenshot: 'off'`, while `smoke` retains failure artifacts.

## 4. Runtime budget

- [x] 4.1 Update `scripts/test-e2e.ts` to print the Playwright JSON duration and wall time and warn above `E2E_BUDGET_SECONDS` (default 300); keep migration outside the measured window.
- [x] 4.2 Run the complete E2E suite and record its measured duration with every critical-flow project still executing. The hard runtime target and per-worker D1 isolation are deferred by owner decision; no retries or skipped flows are used.
  - Local evidence: final run 60/60 pass; Playwright duration 326.5s, wall 327.1s. Four-worker runs hit `SQLITE_BUSY_SNAPSHOT`; per-worker D1 isolation is deferred.

## 5. Integration gate

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; verify all pass and record the E2E duration and bundle-budget output.
  - Gate: typecheck/lint/format pass; unit 368/368; E2E 60/60; build pass; login initial 186.7KB/200KB; vault route 149.6KB/150KB.
- [x] 5.2 Confirm no production code, API, migration, dependency, or product UI changed.

## Workflow follow-up

- Archive the change after review and a green gate.
- Re-run `openspec validate --all --strict` after archive.
