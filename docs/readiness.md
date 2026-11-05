# Readiness — PR 00

Date: 2026-11-05
Scope: `.agent/tasks/TASK-1.json` (requirements TASK-1, TASK-57, TASK-58)

## Status

| Item | Status | Notes |
|------|--------|-------|
| `.env.local` placeholders | Done | All names present; values not committed |
| `.dev.vars` mirror | Done | Created with the same four secrets plus local config; mode 600 and gitignored |
| Real secret values | Done | Four 48-byte random values generated locally and written to both files; values never printed |
| Config values | Done | `APP_ORIGIN`, `TOTP_ISSUER`, `APP_ENV` set for local development |
| Cloudflare authentication | Done | OAuth token valid; account `Alfianyabdullah@gmail.com's Account` |
| D1 database | Done | `bridgewarden-db` created in APAC; id recorded in `.env.local` |
| KV namespace (sessions) | Done | `KV_SESSIONS` created; id recorded in `.env.local` |
| R2 bucket | Deferred | Not used in MVP; `CLOUDFLARE_R2_BUCKET_NAME` stays `TODO` by design |
| Git repository | Done | `git init -b main`; initial commit pending |
| `.gitignore` | Done | Ignores `.env.local`, `.dev.vars`, `.wrangler/`, build and test artifacts |
| `.editorconfig` | Done | UTF-8, LF, 2 spaces, final newline |
| Commit and PR conventions | Done | `CONTRIBUTING.md` |
| `AGENTS.md` | Done | Verify commands, invariants, layout, skills, workflow |
| Documentation links | Verified | React Router on Cloudflare, D1 limits, migrations, rate limiting, WebCrypto |
| Test users | Not applicable yet | First admin via `/setup` after PR 06; members via admin panel after PR 09 |

## Remaining owner actions

1. Back up `AUTH_PEPPER` and `TOTP_ENC_KEY` offline (password manager). Losing either locks
   every account out; rotating them is destructive.
2. Approve the initial commit when ready: `git add -A && git commit`.
3. Approve starting PR 01.

All Cloudflare resources and local secrets are already provisioned. Do not paste secret values
into chat, an issue, or a commit.

## Decision log

| Decision | Value |
|----------|-------|
| Proceed with local PR 00 work while Cloudflare access is missing | Approved by owner |
| Proceed to PR 01 | Unblocked: account, D1, KV, and `.dev.vars` are verified |
| Email provider | Not required in MVP |
| Custom domain | Not required; `workers.dev` |
| Free-tier D1 500MB cap | Accepted for personal/family scale |
