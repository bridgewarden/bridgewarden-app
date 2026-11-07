# Design

## Context

See proposal.md — Why. Current state that shapes the harness:

- Vitest runs through `@cloudflare/vitest-plugin` with the `wrangler.jsonc` bindings and four
  colocated test files under `app/**/__test__/`.
- There is no Playwright dependency, no `e2e/` directory, and no `test:e2e` script.
- `migrations/` contains only `0001_noop.sql`; the real schema arrives in PR #6.
- CI runs install → typecheck → lint → format:check → test → build, with no browser step.
- The dev server needs `NODE_ENV=development` (the shell exports `NODE_ENV=production`) and reads
  `.dev.vars`; no current route requires a secret.
- During PR #4 verification, the first request after Vite dependency optimization returned a 500.

## Goals / Non-Goals

**Goals:**

- One command runs browser tests locally and in CI, with useful failure artifacts.
- Unit tests get an in-memory D1 database with the repository migrations applied.
- E2E runs against a disposable state directory, never the developer's vault data.
- The harness works before the schema exists and grows with it.
- A failing assertion makes both runners exit non-zero.

**Non-Goals:**

- Auth, vault, or item fixtures in this change; those tables do not exist yet.
- Cross-browser coverage (Firefox/WebKit), visual regression, or performance budgets.
- Replacing Vitest for unit tests or adding component-testing libraries.
- Seeding production-like data or touching the development database.

## Decisions

### D1. Playwright with one Chromium project

One Chromium project, `baseURL: http://localhost:8787`, `webServer` running `E2E=1 pnpm dev --port 8787 --strictPort`, `/` as the readiness URL,
`reuseExistingServer: false`, `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`,
`retries: 2` in CI, and `html` + `list` reporters in CI so logs carry assertion text.

Alternatives: Cypress (heavier runtime) or no browser tests (rejected; E2E is a PRD success
criterion). Reusing an existing server was rejected because a stale or unrelated server on the
port would let the suite pass against the wrong code.

### D2. Readiness against the page, not the health probe

`webServer.url` points at `/`, so Playwright waits until the shell's module graph is warm. `/health`
only proves D1 liveness and does not load React Router or the UI dependencies, which is where the
observed first-request flake came from. CI retries twice.

### D3. Unit tests: in-memory D1 with migrations applied per file

The Workers Vitest plugin runs each test run in a fresh Miniflare instance, so unit tests never
touch `.wrangler` development state. `globalSetup` reads `migrations/` with `readD1Migrations` and
provides the list; `setupFiles` calls `applyD1Migrations(env.DB, migrations)` before each file.
`applyD1Migrations` tracks history in `d1_migrations`, so repeated application is idempotent.
Comment-only statements (line and block comments) are filtered because D1 rejects an empty
statement; the baseline migration is one such file.

Alternatives: a second wrangler config with a test database id (duplicated config that drifts) or
reusing the development database (rejected).

### D4. E2E: disposable state directory

`APP_ORIGIN` still points at 5173 from `.dev.vars`, so E2E uses 8787 as a free port. The origin
check in PR #19 must either read the actual request origin in test mode or the E2E command must be
able to override `APP_ORIGIN`; record that when the check lands.

`E2E=1` makes `vite.config.ts` pass `persistState: { path: '.wrangler/e2e' }` to the Cloudflare
plugin, so the Playwright dev server gets its own D1 and KV state instead of the developer's
`.wrangler/state`. That directory is gitignored. When auth specs arrive, they must apply
migrations to this database and may delete the directory between runs.

### D5. resetDatabase: explicit order, production guard

`app/__test__/reset-database.ts` discovers user tables from `sqlite_master`, excludes
`d1_migrations` and D1 internals (`sqlite_*`, `_cf_*`), and deletes children before parents using
an explicit `DELETE_ORDER`. D1 rejects both `PRAGMA foreign_keys = OFF` and
`PRAGMA foreign_key_list` with `SQLITE_AUTH`, so the order must be extended with every table PR #6
adds. The helper throws when `APP_ENV === 'production'` and never drops tables. It is a no-op on
an empty user schema.

### D6. Fixture mechanism now, domain fixtures with the schema

Domain fixtures (`createTestUser`, `createTestItem`) are not written yet: there are no tables to
insert into, and writing them now would encode a second schema. PR #6 adds them next to the
migrations they depend on. This is the one place where `TASK-4` acceptance is split across two
PRs; the proposal records it.

### D7. E2E smoke scope

`e2e/smoke.spec.ts` asserts, in under a minute: `/` renders the shell (one banner, one main,
catalog product name), `/health` returns `ok: true`, `/login` and `/setup` render their catalog
heading with status 200, and the `bw_theme=dark` cookie survives a reload and applies the dark
class. `/app` and `/app/trash` are intentionally excluded until the auth PR, because their
contract is an unauthenticated redirect, not a rendered page.

### D8. CI wiring

CI keeps the gate order and adds: build before the browser step (so an E2E failure cannot skip the
build), `pnpm exec playwright install --with-deps chromium`, `pnpm test:e2e`, and an artifact upload
with `if: always()` and `if-no-files-found: ignore` for `playwright-report/` and `test-results/`.

## Risks / Trade-offs

- [Trace and screenshots can capture cookies and typed plaintext] -> Today only the non-sensitive
  `bw_theme` cookie exists. Auth and vault specs must disable trace/screenshot, and the rule is
  recorded in AGENTS.md before those PRs land.
- [DELETE_ORDER drifts when the schema grows] -> It lists the MVP tables only; PR #6 extends it
  with its tables and adds an assertion that every migrated table is covered.
- [Port 5173 already in use] -> `--strictPort` and `reuseExistingServer: false` fail fast with a
  clear error instead of testing a stale server.
- [First request flakes during Vite optimization] -> Readiness hits `/`, and CI retries twice.
- [`.dev.vars` is absent in CI] -> Routes under test do not read secrets; if a future route does,
  CI must provide non-secret placeholder values.
- [E2E state persists between runs] -> It lives in `.wrangler/e2e`; auth specs will reset it.

## Migration Plan

- Local: `pnpm test:e2e` starts its own dev server on 5173 with `.wrangler/e2e` state.
- CI: one browser install step, one E2E step, and an always-upload artifact step.
- Rollback: remove the Playwright dependency, config, `e2e/`, the setup files, and the CI steps.
  Unit tests are unaffected because the new setup only adds migration wiring.
