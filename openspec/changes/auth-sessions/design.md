# Design

## Context

See `proposal.md` for motivation and `specs/user-auth/spec.md` for behavior. Current constraints:

- PR #8 is merged: `session.ts` mints `{userId, createdAt}` under `session:<sha256>`, `/app` has only
  the empty-table guard, and `/login` is a placeholder.
- `auth-hash.ts` can derive the peppered hash from setup; there is no verification helper.
- `users` has no session version column. Migrations end at `0006_orgs_dormant.sql`.
- `readJsonBody`, `isSameOrigin`, `readConfig`, `getDatabase`, and the in-memory key store already
  exist and should be reused.
- The bootstrap token was intentionally removed; setup is open until the first admin exists.

## Goals / Non-Goals

**Goals:**

- A login flow that is uniform for unknown emails and wrong passwords.
- Opaque sessions with absolute expiry, a D1-authoritative revocation version, and a correct guard.
- Logout and revocation usable by later admin/password/recovery flows.
- A login page that unlocks the vault key in memory without persisting it.
- Tests that cover timing/enumeration shape, cookie contract, stale version, redirect safety, and the
  browser flow.

**Non-Goals:**

- 2FA challenge/enrollment, backup codes, rate limiting, lockout counters, admin user management.
- Vault item APIs, cache, sync, and the lock overlay.
- Password change and recovery reset.
- Signing the session token; the token is opaque and stored hashed.

## Decisions

### D1. Two-phase login with a uniform lookup

`POST /auth/prelogin` accepts `{email}` and always returns
`{kdfAlg, kdfSalt, kdfIterations}` with status 200. A known email returns its stored parameters. An
unknown email returns synthetic parameters from `HMAC-SHA256(AUTH_PEPPER, 'kdf:' || normalizedEmail)`
truncated to 16 bytes, encoded as unpadded base64url. `POST /auth/login` then accepts
`{email, authHash}`.

Alternatives rejected: a single POST cannot derive the client hash without the salt; returning 404
for unknown emails creates an account-enumeration oracle.

### D2. Uniform verification cost

For a known email, the server recomputes `HMAC-SHA256(AUTH_PEPPER, authHash || serverSalt)` and
compares in constant time with the stored `auth_hash`. For an unknown email it uses the synthetic
salt plus a synthetic expected hash and performs the same HMAC/compare, then returns the same 401.
Both paths decode the submitted hash and reject wrong lengths before the comparison. No body or hash
is logged.

### D3. Separate auth API routes and a page route

`/login` is the page (loader + UI). `/auth/prelogin`, `/auth/login`, and `/auth/logout` are
mutation-only route modules registered in `app/routes.ts`, returning JSON and validating `Origin` and
the 256 KiB JSON cap with the helpers from PR #8. This keeps the page transport-thin and gives PR #10
a natural place for `/auth/2fa`.

Alternatives rejected: a single `/login` action with an `intent` field mixes page and API concerns
and becomes crowded when 2FA arrives.

### D4. Absolute 30-day sessions

`createSession` stores the token hash with an absolute KV `expiration` of `createdAt + 30 days` and
sets `Max-Age=2592000`. `lastSeenAt` refreshes at most once per hour with the same absolute
expiration; activity never extends the cookie or KV lifetime. The cookie is not reissued on every
request.

### D5. Session version in D1

Migration `0007_session_version.sql` adds
`session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0)` to `users`. The KV record
carries `ver` copied at issuance. Resolution loads the user and rejects a mismatch, so revocation is
authoritative even if KV still serves a stale record. `revokeUserSessions` increments the column and
does not need to enumerate KV keys.

Alternative rejected: using `vault_rev` as a session counter; it changes for vault sync and would
log users out on unrelated writes.

### D6. Session record and cookie parsing

The KV value is `{userId, createdAt, lastSeenAt, uaHash, ipHash, ver}`. A shared cookie parser reads
`bw_session` from the `Cookie` header. The token must be 43-character unpadded base64url; malformed
values are treated as absent. `getSession(env, request)` returns `{session, user}` only when KV,
status, and version are valid.

`uaHash` / `ipHash` are `HMAC-SHA256(SESSION_SECRET, value)` hex, using `User-Agent` and
`cf-connecting-ip`; both are null when absent. `SESSION_SECRET` is read with `requireSecret`.

### D7. Guard order and return paths

`/`, `/app`, and `/app/*` run `requireConfigured(env)` first, then `requireUser(request, env)`;
`/login` runs `requireConfigured` and redirects to `/setup` while the table is empty. The guard
redirects pages to `/login?next=<encoded>`, where `next` is accepted only as a path beginning with a
single `/` and not `//`. `login` with a valid session redirects to the same safe target or `/app`.
`requireUserApi` throws a 401 data response, never a redirect. A request-scoped cache shares the
session resolution between the root and protected loaders.

### D8. Root session lookup and header logout

The root loader resolves the session optionally through the request cache and returns only the
current user's `{id, displayName, email, role}` or null. `AppShell` shows the signed-in identity plus a logout button that submits JSON
to `/auth/logout` and navigates to `/login`; without a session it keeps the sign-in link. This adds
one KV+D1 lookup to public SSR requests, accepted for a small personal deployment.

### D9. Login page and in-memory unlock

The login page keeps email and password in local state, calls `/auth/prelogin`, derives `authHash`
with the returned parameters, clears the password, posts `/auth/login`, then unwraps `vaultKey` with
the derived wrap key and calls `setVaultKey`. It navigates to `next` or `/app` client-side. No vault
items are fetched, and no key material is persisted.

If unwrap fails after a successful session, the session stays valid but the page shows a generic
error and offers retry; the server never sees the key.

### D10. Audit events and fingerprints

`recordAuditEvent` gains a nullable `userId` so failed logins for unknown emails can be recorded. Event
types: `login.succeeded`, `login.failed`, `logout`. The helper also accepts optional `ipHash`/`uaHash`;
no email, password, auth hash, token, or request body is stored. `login.failed` uses
`metadata = null`; the reason is not persisted.

### D11. 2FA-ready response shape

A successful login returns `requires2fa: false` plus the KDF and wrapped-key fields. PR #10 will add
`requires2fa: true` and a challenge token without breaking the client contract. No `user_2fa` row is
read in this change.

### D12. E2E project order

Projects run `smoke` → `setup` → `auth`. The setup spec must keep the admin it creates (remove its
afterAll reset) so the auth project can sign in with the fixed test credentials. The auth project
disables trace and screenshots because it types a master password and covers login, `/app` access,
logout, and `next` return paths. Global setup and the setup beforeAll still clear state before the
first run.

### D13. Rate limiting and lockout stay deferred

`failed_login_count` / `locked_until` and the RATE_LIMITER binding are not touched; the login action
adds a TODO referencing TASK-10/PR #11. This keeps PR #9 focused on sessions while preserving the
columns for the next slice.

## Risks / Trade-offs

- [Enumeration through timing] → Synthetic KDF parameters and a dummy HMAC/compare keep both paths
  close; the response shape is identical. Full timing parity is not provable in tests, so the
  behavior test asserts shape/status and the design keeps the work symmetric.
- [KV eventual consistency] → Every resolution checks the D1 session version, so revocation does not
  depend on KV propagation.
- [Root loader cost] → One KV and D1 lookup per SSR request, shared with the protected guard; public
  pages do not redirect on a missing session.
- [Login unwrap failure after session issuance] → The session remains valid, but the client cannot
  reach the vault. The UI retries unwrap with the password before navigating; the server cannot
  recover the vault key by design.
- [Secure cookie on localhost] → Chromium treats localhost as trustworthy; other local browsers may
  not. E2E uses Chromium, consistent with PR #8.
- [Password remains in JS memory briefly] → The form clears it immediately after deriving the hash;
  strings cannot be zeroed, and the password is never sent or stored.
- [E2E dependency ordering] → Auth tests depend on the setup project's retained admin. Removing the
  setup afterAll reset is required; the auth project resets state after itself if needed.

## Migration Plan

1. Apply `0007_session_version.sql`; existing users receive version 0.
2. Deploy the new session record shape; old PR #8 sessions have no `ver` and fail closed, so users
   sign in again. That is acceptable because no long-lived accounts exist yet.
3. Rollback: revert the code; the extra column is harmless and the old session helper ignores it.
   Existing sessions minted by this change remain unreadable to the old code and require login again.

## Open Questions

None blocking. Failed-login lockout thresholds and 2FA challenge semantics remain PR #10/#11.
