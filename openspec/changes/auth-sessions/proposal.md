# Proposal

## Why

The first admin can now be created, but there is no way to sign back in: `/login` is a placeholder,
`/app` has no session guard, and the existing session helper only mints a token. Without a password
login, a durable session, logout, and revocation, the deployment is a one-shot setup with no usable
account.

## What Changes

- Add a two-phase password login: a KDF-parameter lookup that returns the same shape for unknown
  emails, and a credential POST that verifies the client `authHash` with the stored pepper and
  constant-time comparison. Unknown email and wrong password both return 401 with the same body.
- Add `/auth/prelogin`, `/auth/login`, and `/auth/logout` mutation routes plus the `/login` page. The
  page derives `authHash` in the browser, never sends the master password, and clears it after use.
- Extend sessions to an absolute 30-day lifetime with KV records
  `{userId, createdAt, lastSeenAt, uaHash, ipHash, ver}`; refresh `lastSeenAt` at most hourly.
- Add a `session_version` counter on `users` and use it as the authoritative revocation check, so a
  stale KV record cannot revive a revoked session.
- Add `requireUser` for `/app/*`: unauthenticated users redirect to `/login?next=<safe path>`;
  disabled users and stale versions are rejected.
- Unwrap `vaultKey` in the login page and keep it only in the existing in-memory key store; no vault
  items are fetched in this change.
- Add a global header session lookup with the signed-in user and a logout action, falling back to the
  existing sign-in link.
- Record `login.succeeded`, `login.failed`, and `logout` audit events with peppered UA/IP hashes and
  no request content.
- Add a data-model requirement for the session version column and a forward migration.

## Capabilities

### New Capabilities

- `user-auth`: password lookup and verification, session issuance and resolution, route protection,
  logout, revocation, and the login response contract.

### Modified Capabilities

- `data-model`: adds the per-user session version used for authoritative session revocation.

## Impact

- New API routes under `app/routes/` and login UI under `app/features/login/`.
- Extended `app/lib/.server/session.ts`, a new auth-hash verification helper, session guard, request
  fingerprint helper, and audit event types.
- Root and protected loaders resolve optional/required sessions; `AppShell` gains a user/logout
  state.
- New migration `0007_session_version.sql`; updates to fixtures, schema tests, and the data-model
  spec.
- Playwright gains an auth project that depends on the setup flow.
- Out of scope: 2FA challenge and enrollment, rate limiting/lockout, admin user management, vault item
  APIs or cache, password change, and recovery.
