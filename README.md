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
BOOTSTRAP_TOKEN=...
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
pnpm test:e2e         # Playwright smoke suite (starts its own dev server on 8787)
pnpm db:migrate:local
pnpm db:migrate:remote
pnpm db:reset:local
```

The app is served at `http://localhost:5173`. `/health` runs `SELECT 1` against D1.

`pnpm test:e2e` starts its own dev server on port 8787 with an isolated `.wrangler/e2e` state
directory, so stop any `pnpm dev` already bound to that port first. Before the first run, install
the browser once:

```bash
pnpm exec playwright install chromium
```

## Cloudflare resources

| Binding        | Resource                                          |
| -------------- | ------------------------------------------------- |
| `DB`           | D1 database `bridgewarden-db`                     |
| `KV_SESSIONS`  | KV namespace `KV_SESSIONS`                        |
| `RATE_LIMITER` | Workers Rate Limiting binding (60 requests / 60s) |

R2 is reserved for phase 2 and is not bound yet.

## Structure

See the project structure section in [`AGENTS.md`](AGENTS.md). Features live in
`app/features/<feature>/`, server infrastructure in `app/lib/.server/`, and route modules in
`app/routes/` stay transport-only.
