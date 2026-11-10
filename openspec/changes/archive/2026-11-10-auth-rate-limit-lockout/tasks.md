# Tasks

## 1. Rate-limit configuration and helper

- [x] 1.1 Replace the single `RATE_LIMITER` binding in `wrangler.jsonc` with `RATE_LIMITER_IP` (60/60s) and `RATE_LIMITER_IDENTITY` (10/60s); verify `wrangler types` exposes both and the Worker builds.
- [x] 1.2 Create `app/lib/.server/rate-limit.ts` with HMAC-keyed IP and identity helpers that return `{ allowed, retryAfter }`; verify unit tests cover allowed, rejected, missing-pepper, and that raw values never appear in keys.

## 2. Account lockout

- [x] 2.1 Extend `app/lib/.server/queries/users.ts` with login-state lookup, atomic failure recording, and failure reset; verify query tests cover increment, lock at ten, reset, and concurrent increments.
- [x] 2.2 Update `loginWithPassword` to check `locked_until`, return 423 with `Retry-After`, record failures atomically, and reset on success; verify login tests cover 10th failure, locked login, and reset.
- [x] 2.3 Update `app/routes/auth-login.ts` to map the locked result to 423 with `Retry-After`; verify route tests assert status and header.

## 3. Route limits

- [x] 3.1 Apply the IP and email limits in `app/routes/auth-login.ts` before password verification; verify an over-budget request returns 429 with `Retry-After` and no session.
- [x] 3.2 Apply the IP limit in `app/routes/auth-prelogin.ts`; verify over-budget returns 429 without a KDF lookup result.
- [x] 3.3 Apply the IP and challenge identity limits in `app/routes/auth-2fa.ts`; verify over-budget returns 429 and does not consume the challenge.
- [x] 3.4 Apply the IP limit in `app/routes/setup.tsx`; verify over-budget returns 429 and creates no user, audit event, or session.

## 4. Tests and documentation

- [x] 4.1 Add unit coverage for the rate-limit helper, lockout query, and login use-case outcomes; verify 172 existing tests plus the new cases pass.
- [x] 4.2 Add route-level tests for 429 and 423 responses, including `Retry-After`; verify the existing auth route test suite passes.
- [x] 4.3 Add a focused E2E case for a locked account if the limiter budget does not interfere with the existing auth flow; verify the full E2E suite remains green.
- [x] 4.4 Update `README.md` with the rate-limit and lockout behavior and the deferred `/auth/recover` wiring; verify the documented routes and status codes match the implementation.

## 5. Integration verification

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; verify the suite remains green.
- [x] 5.2 Confirm unknown emails still return generic 401, locked accounts return 423, over-budget requests return 429, and a successful login clears counters; verify with route tests and the existing auth E2E.

## Workflow follow-up

- Update `PR-PLAN.md` numbering to split TASK-10 into two PRs before opening the pull request.
- Run `/preflight` before opening the PR.
- Archive the change after merge.
