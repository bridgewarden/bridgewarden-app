# Proposal

## Why

TASK-52 and TASK-53 require Playwright to cover folder CRUD, audit evidence, sensitive failure artifacts, and a five-minute runtime budget. The current suite covers every other critical flow, but folder rename/delete and most audit events are only covered by unit or API tests, and authenticated projects disable traces because they can capture plaintext.

## What Changes

- Add a folder lifecycle E2E spec that creates two folders through the UI, renames one through the authenticated folder API using the other folder's valid ciphertext, deletes the other, and verifies the synced vault projection.
- Add an `e2e/audit.ts` helper and a final audit project that asserts the required rows after the critical-flow run: bootstrap, login success/failure, 2FA enrollment/verification/backup code/failure, password change, recovery, admin invitation/role/disable, session revoke, and item purge.
- Scope every audit assertion to the acting user and verify metadata contains no email, item name, ciphertext, password, TOTP code, or token.
- Keep traces and screenshots disabled for authenticated, auth, 2FA, admin, recovery, and vault projects; document that exception and the unauthenticated-only artifact policy in `e2e/README.md`.
- Measure and report the full-suite runtime. The hard five-minute target and per-worker D1 isolation are deferred by owner decision; no retries or skipped flows are used to hide runtime.
- Add no product UI, API, migration, dependency, or runtime behavior.

## Capabilities

### New Capabilities

- `release-e2e`: acceptance coverage for critical user flows, audit evidence, sensitive-artifact handling, and the E2E runtime budget.

### Modified Capabilities

- None.

## Impact

- Modified `e2e/admin-users.spec.ts`, `e2e/vault-list.spec.ts`, `e2e/vault-trash.spec.ts`, `e2e/two-factor.spec.ts`, `e2e/responsive.spec.ts`, `e2e/pwa.spec.ts`, and `e2e/vault-search.spec.ts`.
- New `e2e/vault-folders.spec.ts`, `e2e/audit.spec.ts`, `e2e/audit.ts`, and `e2e/README.md`.
- `playwright.config.ts` and `scripts/test-e2e.ts`.
- `.github/workflows/ci.yml` uploads only unauthenticated smoke failure artifacts.
- No production code, schema, API, or dependency changes.
- TASK-52 and TASK-53 only; TASK-55 documentation and TASK-56 deployment stay in later changes.
