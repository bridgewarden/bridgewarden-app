# Tasks

## 1. Playwright setup

- [x] 1.1 Add `@playwright/test` as a dev dependency, add a `test:e2e` script, and verify `pnpm exec playwright --version` and `pnpm test:e2e --list` both run without configuration errors.
- [x] 1.2 Create `playwright.config.ts` with one Chromium project, `baseURL: http://localhost:8787`, `webServer` running `pnpm dev --port 8787` with `/health` as the readiness URL, `reuseExistingServer` off in CI, `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, and `retries: 2` in CI. Verify the config loads with `pnpm test:e2e --list`.
- [x] 1.3 Document `pnpm test:e2e` and the first-run browser install in the README, and verify the documented commands match `package.json` scripts.

## 2. E2E smoke suite

- [x] 2.1 Add `e2e/smoke.spec.ts` covering `/` (one banner, one main, product name), `/health` (`ok: true`), and the `/login`, `/setup`, `/app`, and `/app/trash` headings. Verify `pnpm test:e2e` passes.
- [x] 2.2 Add a theme assertion that sets the `bw_theme=dark` cookie, reloads, and expects `class="dark"` on `<html>`. Verify the test passes and the suite runner reports under 60 seconds.
- [x] 2.3 Temporarily add a deliberately failing assertion, verify `pnpm test:e2e` exits non-zero and writes a screenshot plus trace under `test-results/` with the default `retain-on-failure` setting, then remove the assertion and confirm the suite passes again.

## 3. Test database wiring

- [x] 3.1 Add `app/__test__/global-setup.ts` that reads `migrations/` with `readD1Migrations` and exposes them, and `app/__test__/setup.ts` that calls `applyD1Migrations(env.DB, migrations)`. Wire both into `vitest.config.ts` and verify a test can query `d1_migrations` through `env.DB`.
- [x] 3.2 Add `app/__test__/db.ts` with `resetDatabase()` that discovers user tables from `sqlite_master`, uses the documented dependency order because D1 rejects both `PRAGMA foreign_keys = OFF` and `PRAGMA foreign_key_list`. Verify it is a no-op on the current baseline schema and that a test can create a temporary table, insert a row, call `resetDatabase()`, and see the table empty.
- [x] 3.3 Add a deterministic pair: one file creates and fills a temporary table, a second file asserts the table is absent and its own database is migrated. A path-based sequencer and `fileParallelism: false` guarantee order. Verify `pnpm test` passes with both files.

## 4. CI

- [x] 4.1 Add a Chromium install step (`pnpm exec playwright install --with-deps chromium`) and a `pnpm test:e2e` step to `.github/workflows/ci.yml`, and verify the workflow file parses as YAML and the same commands pass locally.
- [x] 4.2 Upload `playwright-report/` and `test-results/` on every run with `actions/upload-artifact` (`if-no-files-found: ignore`), and verify the workflow file parses and the paths are already gitignored.

## 5. Integration verification

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` and confirm every command exits 0.
- [x] 5.2 Prove both runners fail loudly: introduce a failing unit assertion and a failing E2E assertion one at a time, confirm non-zero exits and useful output, then revert.
- [x] 5.3 Confirm the test run leaves `.wrangler/` development state untouched and that `playwright-report/`, `test-results/`, and browser binaries are not staged by git.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Open the PR with change id `test-harness` and requirement `TASK-6`.
- Archive the change after the PR is merged.
