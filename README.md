# Bridgewarden

Zero-knowledge password manager for personal and family use, deployed entirely on Cloudflare.
One React Router v8 Worker (SSR) serves the UI and the API; D1 stores ciphertext, KV stores
sessions.

Security boundaries and accepted trade-offs live in [`docs/threat-model.md`](docs/threat-model.md).

Product requirements live in [`.agent/prd/PRD.md`](.agent/prd/PRD.md). Working rules for agents
and humans live in [`AGENTS.md`](AGENTS.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm 12
- A Cloudflare account authenticated with `npx wrangler login`

## Setup

```bash
pnpm install
```

Create `.dev.vars` (Wrangler local secrets) and `.env.local` (tooling) with the same names:

```text
SESSION_SECRET=...
AUTH_PEPPER=...
TOTP_ENC_KEY=...
APP_ORIGIN=http://localhost:5173
TOTP_ISSUER=Bridgewarden
APP_ENV=development
```

Never commit either file, and back up `AUTH_PEPPER` and `TOTP_ENC_KEY`: rotating them locks
every account out.

The Cloudflare Vite plugin copies `.dev.vars` into `build/server/.dev.vars` so local preview
has the secrets. Never archive, upload, or share the `build/` directory. `pnpm deploy` removes
that file before uploading the Worker, and CI does not publish build artifacts.

## Commands

```bash
pnpm dev              # Workers runtime via the Cloudflare Vite plugin
pnpm build
pnpm preview
pnpm deploy            # build, verify remote migrations, upload
pnpm typecheck        # wrangler types + react-router typegen + tsc -b
pnpm lint
pnpm format
pnpm format:check
pnpm test
pnpm test:watch       # Vitest in watch mode
pnpm test app/__test__/reset-database.test.ts   # single file
pnpm test:e2e         # Playwright smoke + setup + auth suites (starts its own dev server on 8787)
pnpm db:migrate:local
pnpm db:migrate:remote
pnpm db:reset:local
```

The app is served at `http://localhost:5173`. `/health` runs `SELECT 1` against D1.

## Deploy order

Run `pnpm db:migrate:remote` before `pnpm deploy`. The deploy script checks
`wrangler d1 migrations list --remote` and refuses to upload while any local migration is pending.
After deploy, `GET /health?schema=1` reports the expected and applied migration counts; a 503 means
the Worker and remote schema are skewed. Never roll back below the applied schema high-water mark.

`pnpm test:e2e` applies migrations to `.wrangler/e2e` before starting its own dev server on port
8787 with isolated state, so stop any `pnpm dev` already bound to that port first. Before the first run, install
the browser once:

```bash
pnpm exec playwright install chromium
```

## First-run setup

Open `/setup` on a deployment whose `users` table is empty. The wizard creates the first
administrator and shows the recovery key once. `/setup` redirects to `/login` as soon as an account
exists; the server also enforces the one-admin rule atomically, so a concurrent second request gets 409.

While the user table is empty, `/` and `/app/*` redirect to `/setup`. There is no bootstrap token:
the first visitor to an empty deployment can create the admin. Keep the deployment private until you
have completed setup, and reset the local D1 state if you need to retry.

E2E uses an isolated `.wrangler/e2e` database. `pnpm test:e2e` applies migrations and clears the
`users`, `audit_events`, and session keys before starting. CI generates throwaway `.dev.vars` values.
To reset the E2E database manually:

```bash
pnpm exec wrangler d1 execute bridgewarden-db --local --persist-to .wrangler/e2e --command "DELETE FROM users"
```

## Login and sessions

`/login` is a two-step password flow: the browser fetches KDF parameters from
`POST /auth/prelogin`, derives `authHash` plus the wrap key locally, and posts only the hash to
`POST /auth/login`. Unknown emails receive synthetic KDF parameters with the same shape, and unknown
email or wrong password both return a generic 401.

A successful login sets the `bw_session` cookie (HttpOnly, Secure, SameSite=Lax, Path=/, 30 days
absolute) and stores only the token hash in `KV_SESSIONS`. Activity refreshes `lastSeenAt` at most
once per hour but never extends expiry. `users.session_version` is the authoritative revocation
state; incrementing it invalidates every existing session.

`POST /auth/logout` deletes the session, clears the cookie, and records an audit event. `/` and `/app/*` redirect unauthenticated visitors to `/login?next=<same-origin path>`; unsafe return paths
fall back to `/app`. The header shows the signed-in user with a **Sign out** action.

Auth abuse controls use the Workers Rate Limiting binding with HMAC-derived keys: 60 requests/minute
per IP hash and 20 requests/minute per account identity. Rejected requests return 429
with `Retry-After`. Ten consecutive password failures lock the account for 15 minutes; a locked
login returns 423 with `Retry-After`, and a successful login clears both counters. Rate limiting for
`/auth/recover/lookup` and `/auth/recover/reset` use the same IP/identity limits and a separate recovery proof; recovery failures do not lock the account, because the proof is 128-bit and lockout would let anyone deny recovery.

## Master password rotation

`/app/settings` can change the master password after confirming the current one. The browser
unwraps the existing vault key and re-wraps the same key under a new master key; vault item
ciphertext is not re-encrypted. The server replaces the auth hash, KDF parameters, and vault-key
wrapper in one update, increments the session version, and reissues the current cookie. Other
sessions are signed out. The recovery key remains valid because its wrapper is unchanged.

## Vault recovery

`/recover` resets a lost master password using the recovery key saved at setup. The browser unwraps
the vault key with the recovery key, forces a new master password, and re-wraps the same vault key.
The server verifies a separate `bw-recovery-auth` proof, replaces the password, KDF, vault wrapper,
recovery wrapper, and recovery proof in one guarded update, increments the session version, and
issues a new session. If session issuance fails after the update commits, the new recovery key is
still shown once and the user is sent to sign in with the new password. The recovery key is a
break-glass credential: a successful reset bypasses a TOTP challenge, and the server records a
separate audit marker when that happens. The old recovery key is burned: it no longer unwraps the vault or satisfies
the proof. Accounts created before recovery verifiers were added cannot use this flow until their
recovery key is regenerated; there is no email or escrow fallback.

## Vault API

The authenticated vault API stores ciphertext only. `GET /api/vault?since=<rev>` returns items and
folders newer than the watermark, including tombstones, with `serverRev` and an opaque
`nextCursor` when the 500-row page is truncated. `POST /api/vault/items` creates an encrypted item
with a new global revision; `PATCH /api/vault/items/:id` requires the current `rev` and returns 409
with the server row on a mismatch. Every query is scoped to the session user, foreign ids return 404,
and bodies are limited to 256KB with ciphertext capped at 64KB. Items can be soft-deleted with `DELETE /api/vault/items/:id`, restored with
`POST /api/vault/items/:id/restore`, and permanently removed with
`POST /api/vault/items/:id/purge` plus `{ "confirm": true }`. Deletes and restores are idempotent.
A daily cron at 03:00 purges tombstones older than 30 days in batches of 1000.

Folders are ciphertext-only. `GET /api/folders` lists active folders, `POST /api/folders` creates
one, `PATCH /api/folders/:id` renames with the current `rev`, and `DELETE /api/folders/:id`
soft-deletes it. Folder delete marks a tombstone, detaches contained items with the same revision,
and the tombstone appears in the next sync. Folder tombstones are retained for offline devices.

Vault and folder reads and mutations are IP rate-limited and return `Cache-Control: no-store`. The
trash UI is a separate follow-up change.

## Local vault cache

After unlock, the browser caches ciphertext items and folders plus wrapped vault-key material in
IndexedDB (`bridgewarden-vault`). Sync resumes from the stored `serverRev`/cursor and applies
tombstones; the watermark advances only after the last page succeeds. Wrapped key material expires after 30 days. The unwrapped vault key stays
in a module-scoped variable and is never persisted. Logout and account switch wipe every store.
When IndexedDB is unavailable the app runs online-only and reports degraded mode.

Pending mutations are stored in a durable IndexedDB outbox. Item creates carry a client-generated
UUID so a retry after an ambiguous failure returns the existing row instead of duplicating it. The
outbox flushes in order, stops on the first network/5xx failure, rolls back optimistic rows on 409,
and emits conflict/error events for the UI. Offline reload still requires the PWA/service worker
work.

The header lock action discards the in-memory vault key while keeping ciphertext, wrapped key
material, and the session. A reload of a protected route starts locked; entering the master
password unwraps the cached key locally without a server request. If cached material is missing or
expired, the overlay offers sign-out and login instead. Five failed local unlock attempts force a
sign-out and wipe.

The idle auto-lock defaults to 15 minutes and is configurable in account settings as 1, 5, 15, 30,
60, or never. Pointer, keyboard, touch, and scroll activity restart the deadline. An optional,
default-off setting locks immediately when the tab becomes hidden; without it, the idle deadline
still applies. Only the timeout and tab-hide flag are stored locally; they contain no vault data.
A successful sign-out resets them to the default policy. Locking one tab locks sibling tabs in the same browser profile.

The vault list decrypts cached ciphertext in memory only. It shows item name, username, folder,
favorite, and type, with combined type/folder/favorite filters and name/updated sorting. `j`/`k` or
the arrow keys move the active row and Enter opens a read-only detail. `Ctrl/Cmd+K` opens an
in-memory search palette across decrypted names, usernames, URLs, notes, and secure-note bodies;
queries never leave the browser. The empty state creates a minimal named login or note through the encrypted
outbox, so the item appears immediately and syncs when online. Full item fields, editing, and
delete remain in the editor changes.

## User management

Administrators can open `/admin/users` to list accounts, create setup invitations, change roles,
disable or enable users, and revoke sessions. Invitations expire after 24 hours and store only a
token hash; the admin copies the setup link manually and no email is sent.

`/setup/member?token=...` lets the invited member create their own master password and recovery key
in the browser. The invitation is consumed and the user row is created atomically, so the same token
cannot create two accounts. Disabling a user increments the session version, invalidating all their
sessions. The last active administrator cannot be disabled or demoted.

## Two-factor authentication

Enable TOTP from `/app/settings` by confirming your master password. The page shows an `otpauth://`
URI, a locally rendered QR code, and the secret once; verify a six-digit code to enable 2FA and receive
ten one-time backup codes. Backup codes are stored only as HMAC hashes and shown once; regenerating
replaces every old code and also requires the master password. Until 2FA is enabled, a non-dismissible
reminder banner stays above the header.

When 2FA is enabled, `/auth/login` returns only a five-minute challenge token and no session or
wrapped vault key. The session and unlock material are issued only after `/auth/2fa` accepts a TOTP
code within the ±1 step window or an unused backup code. Challenge attempts are counted atomically in
D1; the fifth failure consumes the token, and a consumed token cannot be resurrected. Replay is
prevented by `last_totp_step`.

Enrollment, regeneration, and disabling each require the current master password, re-derived in the
browser and verified server-side.
This is the one deliberate zero-knowledge exception: the TOTP seed must be decryptable by the server
to verify codes before the vault key exists. It is stored with AES-256-GCM under a key derived from
`TOTP_ENC_KEY`, bound to the user, and never returned after enrollment.

## Cloudflare resources

| Binding                 | Resource                                                     |
| ----------------------- | ------------------------------------------------------------ |
| `DB`                    | D1 database `bridgewarden-db`                                |
| `KV_SESSIONS`           | KV namespace `KV_SESSIONS`                                   |
| `RATE_LIMITER_IP`       | Workers Rate Limiting binding, 60 requests / 60s per IP hash |
| `RATE_LIMITER_IDENTITY` | Workers Rate Limiting binding, 20 requests / 60s per account |

R2 is reserved for phase 2 and is not bound yet.

## Structure

See the project structure section in [`AGENTS.md`](AGENTS.md). Features live in
`app/features/<feature>/`, server infrastructure in `app/lib/.server/`, and route modules in
`app/routes/` stay transport-only.
