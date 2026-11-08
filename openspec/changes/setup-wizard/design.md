# Design

## Context

See `proposal.md` for motivation and `specs/account-bootstrap/spec.md` for the behavior contract.

Current constraints found in the repository:

- PR #7 is merged on `origin/main` and provides `app/lib/crypto/` (`deriveMasterKey`, `deriveAuthHash`,
  `deriveWrapKey`, `generateVaultKey`, `wrapVaultKey`, `generateRecoverySecret`,
  `formatRecoveryKey`, `wrapVaultKeyWithRecovery`). The local `main` checkout used to write this
  design does not yet contain those files; apply must start from merged `main`.
- The schema from PR #6 already has every column setup needs: `users` with KDF parameters, wrapped
  keys, `server_salt`, `auth_hash`, role/status, and `audit_events`.
- `app/lib/.server/` has only `context.ts` (React Router context with Cloudflare bindings) and
  `env.ts` (`requireSecret`). There is no D1 handle module, session helper, audit helper, or origin
  guard yet.
- `app/routes/setup.tsx` and `app/features/setup/setup.tsx` are placeholders. Routes are declared
  explicitly in `app/routes.ts`; the setup route is already registered.
- `package.json` does not include Zod. `nodejs_compat` is enabled in `wrangler.jsonc`.
- Playwright runs one chromium project on port 8787 with isolated `.wrangler/e2e` state, but nothing
  applies migrations or clears data, and CI never creates `.dev.vars`.

## Goals / Non-Goals

**Goals:**

- One-time administrator creation that stays correct under concurrent requests.
- A wizard that derives and wraps keys in the browser and sends only wrapped values.
- Reuse of the PR #7 crypto contract without adding new crypto primitives or ciphertext columns.
- A session handoff that is compatible with PR #9, so #9 does not need to invent a second cookie.
- Tests that prove the race, the token gate, the transport encoding, and the browser flow.

**Non-Goals:**

- Login, session resolution, route guards, logout, or revocation (PR #9).
- TOTP secret generation, QR enrollment, or backup codes (PR #10).
- Admin user management, rate limiting, or lockout (PR #11).
- Vault item UI or cache (PRs #14+).
- Password strength policy beyond a ≥12-character floor and an advisory meter.

## Decisions

### D1. Split availability semantics between GET and POST

GET `/setup` computes `isBootstrapAvailable(db)`. When false it throws `redirect('/login')`. The
loader returns no data; the page renders without an availability prop. POST never relies on the
pre-check; it attempts the atomic insert and returns 409 when `changes === 0`. React Router sends
fetch/`.data` POSTs straight to the action, while a document POST still re-runs the loader and
redirects to `/login`; the 409 contract is therefore exercised through `.data` requests.

Alternative rejected: returning a 409 page from the loader. It satisfies the status code but leaves
the user on a dead setup page instead of the login screen.

### D2. The guard is the insert itself

`createFirstAdmin` runs one statement:

```sql
INSERT INTO users (id, email, display_name, auth_hash, server_salt, kdf_alg, kdf_iterations,
  kdf_salt, vault_key_wrapped, vault_key_wrap_iv, recovery_key_wrapped, recovery_key_wrap_iv,
  role, status, vault_rev, failed_login_count, created_at, updated_at)
SELECT ?, ?, ?, ?, ?, 'pbkdf2-sha256', ?, ?, ?, ?, ?, ?, 'admin', 'active', 0, 0, ?, ?
WHERE NOT EXISTS (SELECT 1 FROM users)
```

`meta.changes === 1` means created; `0` means another request won and maps to 409. No `COUNT(*)`
appears in the write path. Alternative rejected: `db.batch` with a count statement, which still has
a check-then-act gap when the statements are not conditional.

### D3. Token comparison is constant-time over equal-length byte arrays

`verifyBootstrapToken(env, submitted)` reads `BOOTSTRAP_TOKEN` defensively. When it is missing or
empty, the function returns false with the same outward behavior as a wrong token. It encodes both
values as UTF-8 and compares with a small XOR loop only after confirming equal length, so mismatched
lengths are rejected without a data-dependent scan. No Node-only helper is needed.

Alternatives rejected: `===` (timing leak), `node:crypto.timingSafeEqual` (works but pulls a Node
API into a Worker path for no gain), and hashing both values and comparing digests (still needs a
constant-time digest comparison).

The route adds a TODO referencing PR #11 for rate limiting and lockout of repeated token attempts.

### D4. Base64url on the wire, standard base64 in storage

A client-safe module `app/lib/base64-url.ts` exposes `toBase64Url` and `fromBase64Url`. It strips and
restores `+`/`-`, `/`/`_`, and padding, and rejects non-canonical input. The setup action validates
the transport form with Zod, decodes it to check exact byte lengths, and stores the standard padded
form. The crypto module then reads exactly what it already expects.

Lengths enforced server-side: `kdfSalt` 16 bytes, `vault_key_wrap_iv` 12, `recovery_key_wrap_iv` 12,
`vault_key_wrapped` 48 (32-byte key + 16-byte tag), `recovery_key_wrapped` 48, and `authHash` 32.

Alternative rejected: storing base64url directly. It would force every future crypto caller and the
extension to convert before decoding, and contradicts the PRD storage convention.

### D5. Server-side peppered authentication hash

The action generates a 16-byte `serverSalt` with `crypto.getRandomValues`, then computes
`HMAC-SHA256(AUTH_PEPPER, authHash || serverSalt)` with WebCrypto. It stores the digest and the salt
as standard base64. The client `authHash` is never stored and never returned.

Alternative rejected: storing the client hash directly. A database leak would then allow an offline
password-guessing pass against the PBKDF2 output without the server pepper.

### D6. Minimal session issuance, full resolution deferred to PR #9

`app/lib/.server/session.ts` creates a 32-byte token, stores `session:<sha256hex>` in `KV_SESSIONS`
with `{ userId, createdAt }`, and builds the cookie contract: `bw_session`, `HttpOnly`, `Secure`,
`SameSite=Lax`, `Path=/`, `Max-Age=2592000`. PR #9 adds resolution, last-seen updates, logout, and
revocation on top of the same helper and record shape.

Alternatives rejected: an unsigned placeholder cookie (not a real session, and #9 would have to
replace it) and deferring the cookie entirely (fails the setup completion requirement).

### D7. The vault key lives in a module-scoped memory store

`app/lib/vault/key-store.ts` holds one `Uint8Array | null` with `setVaultKey`, `getVaultKey`, and
`clearVaultKey`. Setup calls `setVaultKey` after a successful action and navigates to `/app`
client-side, so the transition is unlocked. A reload creates a new module instance and therefore a
locked vault. Nothing writes to cookies, local/session storage, or IndexedDB.

This is the seam PR #14 will build the vault cache and lock lifecycle on. Alternative rejected:
React context in the setup feature, which unmounts on navigation and would drop the key before the
vault route renders.

### D8. Client key generation is a pure, testable function

`app/features/setup/setup-keys.ts` exports one async function that takes the password and returns the
six transport-ready fields plus the unwrapped `vaultKey` and the formatted recovery key. The wizard
calls `setVaultKey(vaultKey)` and zeroes that local buffer immediately, so reducer state only receives
`SetupTransportMaterial` and the display-only recovery string. The recovery string is blanked on
confirmation, and `clearVaultKey()` runs on forbidden/409 responses and on leaving setup.

It uses only `app/lib/crypto/` and `app/lib/base64-url.ts`. Because it is independent of React, Vitest
can assert lengths, base64url canonicality, recovery round-trip, and that wrapping round-trips with
the derived wrap key. The password string is not returned.

### D9. Wizard state machine with no persistence

A single reducer in `features/setup/` holds `step`, the validated token/email/display name, transport
material, the display-only recovery string, and the last error. Text inputs and the recovery
confirmation stay in local component state; the password is never retained after derivation. Steps
are: token → account → password → recovery → two-factor → submitting, plus `configured` (redirect to
login on 409) and `done` (client navigation).

Once key material exists, `useBlocker` (client-side navigation) and a `beforeunload` listener
(handled through an `AlertDialog` for in-app navigation) require confirmation. A failed network
request keeps the derived values in memory so the user can retry without re-deriving; a reload loses
them and restarts the wizard, creating no partial row because no write happens until the final POST.

Recovery confirmation accepts the first six normalized characters of the displayed key. Comparison
is case-insensitive and ignores separators, matching `parseRecoveryKey` normalization.

### D10. Server module layout

| Module | Responsibility |
| --- | --- |
| `app/lib/.server/db.ts` | `getDatabase(env)` returns the `DB` binding, the single D1 handle entry point |
| `app/lib/.server/bootstrap.ts` | `isBootstrapAvailable(db)`, `createFirstAdmin(db, input)` |
| `app/lib/.server/bootstrap-token.ts` | constant-time token verification |
| `app/lib/.server/auth-hash.ts` | server salt generation and peppered HMAC |
| `app/lib/.server/audit.ts` | `recordAuditEvent(db, event)` |
| `app/lib/.server/session.ts` | `createSession`, `destroySession`, and cookie serialization |
| `app/lib/.server/request-body.ts` | JSON content-type, 256 KiB cap, and JSON parsing |
| `app/lib/.server/request-origin.ts` | same-origin check against `APP_ORIGIN` |
| `app/features/setup/.server/setup-input.ts` | Zod schema, base64url decoding, length checks |
| `app/features/setup/.server/use-cases/complete-bootstrap.ts` | token, pepper, session, atomic insert, audit |

The route module stays transport-only: loader resolves availability, action calls these helpers in
order, and the feature receives data as props. No SQL, hashing, or token logic lives in the route.

### D11. Audit after successful insert, never on failure

The use-case creates the session before the atomic insert, deletes it if the insert loses the race
or throws, then writes `bootstrap.created` with `user_id`, `created_at`, and null network identifiers.
IP/UA hashing belongs to the shared request-fingerprint work in PR #9; the columns are nullable.
Failed token, validation, origin, or guard paths write nothing.

If the audit insert fails after the user row exists, setup is already consumed. The use-case returns
success and logs the static `bootstrap.audit_failed` event in server infrastructure (never in the
route), rather than failing a request that cannot be replayed.

### D12. Two-factor handoff is informational in this change

The wizard offers an informational two-factor step with the PRD warning and an explicit "enroll later"
message; there is no toggle that promises an effect it cannot deliver. Completion is never blocked
and no `user_2fa` row is touched. PR #10 replaces the step with the enrollment flow and POST-endpoint
handoff.

### D13. E2E database and secret preparation

Playwright `globalSetup` and a `test.beforeAll` reset run through one helper before the dev server
and before each retry. It uses the Wrangler CLI against the isolated state only:

```bash
wrangler d1 migrations apply bridgewarden-db --local --persist-to .wrangler/e2e
wrangler d1 execute bridgewarden-db --local --persist-to .wrangler/e2e --command "DELETE FROM users"
```

Deleting `users` cascades folders, items, 2FA, and backup codes and nulls audit user references. The
helper also clears `session:*` KV keys so stale cookies cannot point at deleted users, so each run and
retry starts available. The command is pinned to `--local` and the E2E persist path; no remote
database is reachable from this script.

The bootstrap token is never committed or hardcoded. A Playwright helper reads
`process.env.E2E_BOOTSTRAP_TOKEN` first and otherwise parses the `BOOTSTRAP_TOKEN` line from the
gitignored `.dev.vars`. CI generates throwaway random values for a temporary `.dev.vars` and exports
the same token through `$GITHUB_ENV`; values are never echoed.

Projects run in order: `smoke` (existing route checks, including the available `/setup`) then
`setup` (wizard flow), with the setup project disabling trace and screenshots because it types a
password, matching the AGENTS rule for auth specs. `workers` is 1 for determinism because the setup
test changes global database state.

Alternatives rejected: a reset HTTP endpoint (a destructive surface in production code) and a
per-test random database (the Vite plugin binds one persist path per server).

### D14. Validation and response shape

Zod validates a strict object: token (1–512 chars), email (trim, lowercase, max 254, format),
display name (1–100 after trim), `kdfIterations` (safe integer from the contract minimum up to a
10,000,000 DoS cap), and the six base64url strings. Unknown keys are rejected. Bodies must be
`application/json` and at most 256 KiB. Responses are:

- 400 `{ error: 'invalid-input' }` for schema failures;
- 413 or 415 `{ error: 'invalid-input' }` for oversized bodies or a non-JSON content type;
- 403 `{ error: 'forbidden' }` for origin or token failures;
- 409 `{ error: 'already-configured' }` for a lost race;
- 500 `{ error: 'server-error' }` for missing pepper, D1, or KV failure;
- 200 `{ ok: true }` plus `Set-Cookie` on success.

Bodies never echo submitted values. The client maps status codes to catalog messages.

### D15. Same-origin check before any read of secrets

`isSameOrigin(request, appOrigin, allowRequestOrigin)` requires an `Origin` header and compares it
with `APP_ORIGIN`. The request-URL fallback is enabled only when `APP_ENV === 'development'` (local
development and E2E), never in production. It runs before reading the body or token. React Router also aborts a forwarded action whose
`Origin` differs from the request URL with 400, so the action-level 403 is defense in depth.
Alternative rejected: a CSRF token, which adds state for a same-site form that already has
SameSite=Lax and an origin check.

## Risks / Trade-offs

- [Audit insert fails after the user exists] → Setup is consumed without an event. The action still
  succeeds, and the failure is logged without request content; a retry cannot create a second admin.
- [Trusting a client-generated `authHash`] → A holder of the bootstrap token could submit a weak
  hash. The token is owner-only and single-use; rate limiting and lockout arrive in PR #11.
- [In-memory key store is a singleton] → Only one account can be unlocked per browser tab, which is
  the product model; PR #14 owns multi-tab behavior.
- [Secure cookie on local HTTP] → Chromium treats localhost as trustworthy and stores it, but other
  browsers may not. Local development can use the same cookie because E2E runs Chromium; this is
  documented rather than adding an insecure fallback.
- [Session created before the insert] → A lost race leaves a transient KV key; the use-case deletes it
  on `exists` and on D1 failure, so no usable session can outlive a failed bootstrap.
- [E2E deletes all users] → The command is local-only and restricted to `.wrangler/e2e`; a mistake in
  the persist path would still not reach production D1.
- [Password remains in JS memory briefly] → Strings cannot be zeroed. The field is cleared right
  after derivation and never stored or sent.
- [UUID version] → Setup uses `crypto.randomUUID()` (v4), matching existing fixtures, while the PRD
  mentions UUIDv7. No behavior depends on the version; a v7 generator can arrive with admin user
  creation in PR #11 without a migration.
- [Two-factor step is a no-op] → Users may believe they enrolled. The step is informational, states
  that enrollment arrives later, and has no toggle rather than silently accepting one.

## Migration Plan

No schema migration. Deploy adds routes, modules, one dependency, and test configuration. Rollback
removes them; a first admin created during a failed rollout remains a valid account and can log in
once PR #9 ships, or the database can be reset in a non-production environment.

## Open Questions

None blocking. TOTP enrollment UX and the TASK-19 session record fields are owned by PRs #10 and #9
and do not change this design.
