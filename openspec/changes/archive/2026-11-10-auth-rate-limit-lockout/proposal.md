# Proposal

## Why

Authentication currently has no abuse control. `/auth/login` accepts unlimited password attempts, `/auth/2fa` relies only on a five-attempt per-token cap, and `/setup` is reachable by repeated requests. The `users` table already carries `failed_login_count` and `locked_until`, but nothing reads or updates them. This change closes that gap before admin user management is added.

## What Changes

- Add a server-side rate limit helper over the Workers Rate Limiting binding, keyed by HMAC hashes rather than raw IP or email values.
- Apply limits to the existing auth surfaces:
  - `/auth/login` — per-IP and per-email budget
  - `/auth/prelogin` — per-IP budget
  - `/auth/2fa` — per-IP budget and per-challenge/per-user budget where an identity is available
  - `/setup` — per-IP budget
- Return `429` with `Retry-After` when a limit rejects a request.
- Implement account lockout on password login: ten consecutive failures set `locked_until = now + 15 minutes`; a locked account returns `423` with `Retry-After`.
- Reset `failed_login_count` and `locked_until` on successful password login.
- Make failure counting atomic in D1 so concurrent attempts cannot exceed the threshold.
- Add query operations for lock state, failure recording, and lock reset.
- Defer `/auth/recover` rate limiting until the recovery route exists in the account-security change; the helper is designed for that reuse.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-auth`: adds rate limiting for login/prelogin/2FA and account lockout behavior.
- `account-bootstrap`: adds rate limiting to the setup endpoint.

## Impact

- New `app/lib/.server/rate-limit.ts` and query operations in `app/lib/.server/queries/users.ts`.
- Changes to `app/routes/auth-login.ts`, `auth-prelogin.ts`, `auth-2fa.ts`, `routes/setup.tsx`, and login use-cases.
- `wrangler.jsonc` rate limit budget may change from the current 60/minute to the auth budget.
- No schema migration: `failed_login_count` and `locked_until` already exist.
- No admin UI or setup-token work; that is the separate `TASK-25` change.
- Unit and E2E coverage for 429, 423, reset, and cross-account isolation.
