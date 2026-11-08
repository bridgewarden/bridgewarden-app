# Proposal

## Why

A fresh deployment has no accounts, no email infrastructure, and no recovery path, so the very first
administrator has to be created safely from the browser exactly once. Without an atomic
bootstrap, a public Worker could be claimed by the first visitor, or two concurrent requests could
create two admins.

## What Changes

- Add `/setup` as a multi-step first-run wizard: account details, master password
  with strength meter (minimum 12 characters), recovery-key display and confirmation, optional 2FA
  handoff, completion.
- Gate the route on an empty `users` table. A non-empty table redirects GET requests to `/login`;
  a raced POST returns 409.
- Create the first admin with one `INSERT … SELECT … WHERE NOT EXISTS (SELECT 1 FROM users)`
  statement so concurrent requests produce exactly one row; treat `meta.changes === 0` as 409.
- Generate all key material in the browser using the PR #7 crypto contract: `kdfSalt`, `masterKey`,
  `authHash`, random `vaultKey`, wrapped vault key, recovery secret, and recovery-wrapped vault key.
  Only derived and wrapped values cross the network; the password and recovery secret never do.
- Transport binary values as unpadded base64url, store them as standard padded base64, and derive
  `auth_hash = HMAC-SHA256(AUTH_PEPPER, authHash || serverSalt)` on the server.
- Issue the `bw_session` cookie after successful creation using a minimal session-issuance helper
  that matches the TASK-19 cookie contract; session resolution, guards, and logout stay in PR #9.
- Keep the unwrapped vault key only in an in-memory key store so the client-side transition to
  `/app` is unlocked; nothing is written to storage.
- Record a `bootstrap.created` audit event for the new administrator.
- Add Zod for request validation, unit tests for guard/transport/key generation, an isolated
  E2E database reset, and a Playwright setup flow.
- Add test-only CI preparation for `.dev.vars` so E2E can run without committing secrets.

## Capabilities

### New Capabilities

- `account-bootstrap`: first-run administrator creation, the single-use availability gate,
  client-side key generation during setup, recovery-key confirmation, session handoff, and the
  bootstrap audit event.

### Modified Capabilities

None.

## Impact

- New route modules under `app/routes/`, feature UI and server input under `app/features/setup/`, and
  server infrastructure under `app/lib/.server/` (bootstrap guard, audit, minimal
  session issuance, origin check).
- A small client-safe base64url transport helper and an in-memory vault key store under
  `app/lib/vault/`.
- New dependency: `zod`.
- New migrations: none. Uses `users`, `audit_events`, and `KV_SESSIONS` from PRs #2/#6.
- Playwright configuration, a global setup that migrates and resets the isolated `.wrangler/e2e`
  database, and CI steps that generate throwaway test secrets.
- All user-facing copy is added to `app/lib/i18n/en.ts`; no third-party scripts, fonts, or UI
  dependencies beyond the existing shadcn source.
