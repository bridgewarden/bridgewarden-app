# Tasks

## 1. Shared query modules

- [x] 1.1 Create `app/lib/.server/queries/users.ts` with low-level functions accepting `D1Database`, row types, camelCase mapping, and `createUsersQueries(env)`; verify a new query test covers user lookup by id/email and session-version increments.
- [x] 1.2 Create `app/lib/.server/queries/user-two-factor.ts` with enabled lookup, enrollment read/write and TOTP step update plus the `createUserTwoFactorQueries(env)` factory; verify query tests cover enabled/disabled rows.
- [x] 1.3 Create `app/lib/.server/queries/audit-events.ts` and `app/lib/.server/queries/two-factor-challenges.ts`, moving the existing audit insert and challenge SQL verbatim behind low-level functions and factories; verify challenge tests still cover expiry, atomic failure count, and consume.
- [x] 1.4 Add the shared-versus-feature query placement rule and the "no SQL outside `queries/`" rule to `AGENTS.md`; verify the wording matches `app/lib -> db` dependency direction and does not require `app/lib -> app/server`.

## 2. Shared server libraries

- [x] 2.1 Replace direct SQL in `app/lib/.server/session.ts` with `createUsersQueries(env)` and remove its `getDatabase` import; verify session and require-user tests still pass.
- [x] 2.2 Replace direct SQL in `app/lib/.server/audit.ts` with the audit-events query module while preserving `recordAuditEventSafe` behavior; verify audit tests still pass.
- [x] 2.3 Replace direct SQL in `app/lib/.server/challenge.ts` with the challenge query module, keeping atomic `UPDATE ... WHERE` semantics and token hashing; verify challenge and verify-challenge tests pass.
- [x] 2.4 Replace direct SQL in `app/lib/.server/complete-login.ts` and `app/lib/.server/bootstrap.ts` with the users query module; verify complete-login and bootstrap tests pass.
- [x] 2.5 Replace SQL in `app/root.tsx` and `app/routes/health.tsx` with query helpers (root 2FA flag and a health database check); verify root route tests and `/health` E2E pass.

## 3. Login call sites

- [x] 3.1 Replace the SQL and `getDatabase` usage in `app/features/login/.server/use-cases/login.ts` with user and user-two-factor queries while preserving generic 401 behavior and the challenge branch; verify login tests pass.
- [x] 3.2 Replace the SQL in `app/features/login/.server/use-cases/prelogin.ts` with the user query module, preserving the synthetic-salt path for unknown emails; verify prelogin tests pass.

## 4. Two-factor feature

- [x] 4.1 Create `app/features/two-factor/.server/queries/two-factor.ts`; move backup-code generation/consumption/counting and the disable batch into them; verify backup-code and lifecycle tests pass.
- [x] 4.2 Replace SQL in `enroll.ts`, `verify-enrollment.ts`, `disable.ts`, `regenerate.ts`, `verify-challenge.ts`, and `two-factor-summary.ts` with feature/shared query factories; verify all two-factor tests pass.
- [x] 4.3 Confirm production code no longer calls `prepare()` outside `queries/` and `app/__test__`; verify with a repository-wide search and typecheck.

## 5. Integration verification

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; verify 172/172 unit (168 existing + 4 query tests) and 16/16 E2E remain green.
- [x] 5.2 Confirm no behavior changed by comparing query results and auth flows against the existing E2E suite; verify registration, login, 2FA enrollment, backup-code login, disable, and health checks.

## Workflow follow-up

- Run `/preflight` before opening the refactor PR.
- Archive the change after the PR is merged and verified.
