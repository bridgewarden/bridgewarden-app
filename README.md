# Bridgewarden

Zero-knowledge password manager for personal and family use, deployed entirely on Cloudflare.
One React Router v8 Worker (SSR) serves the UI and the API; D1 stores ciphertext, KV stores
sessions.

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
pnpm deploy
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
`/auth/recover` will be wired when that route lands with account security.

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
