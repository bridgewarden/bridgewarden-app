# Proposal

## Why

CI currently runs typecheck, lint, format, unit tests, and build, but there is no browser
coverage and no way to apply migrations to an isolated test database. Every later PR (auth,
setup, vault CRUD, lock/unlock) depends on end-to-end proof, and the missing `pnpm test:e2e`
script is already recorded as a preflight blocker. Establishing the harness now keeps those PRs
from each inventing their own runner and fixtures.

## What Changes

- Add `@playwright/test` with `playwright.config.ts`: one Chromium project, `webServer` running
  `pnpm dev --port 8787`, `baseURL`, trace on first retry, screenshot on failure.
- Add `e2e/` with a smoke suite that covers the shell, `/health`, placeholder routes, and the
  theme cookie. It stays under one minute.
- Add the `test:e2e` script and wire it into CI with a Chromium install step.
- Extend the Vitest Workers setup so migrations in `migrations/` are applied to the test D1
  binding before tests run, with a reset helper available to test files.
- Add test helper scaffolding under `app/__test__/` for database access and shared fixtures.
- No application behavior changes; `skip_specs` is set because this is tooling only.

Scope note: `TASK-4` asks for fixtures that create users and vault rows. Those tables do not
exist yet (schema is PR #6), so this change ships the fixture mechanism and database helpers;
the domain fixtures themselves land with the schema change that creates the tables.

## Capabilities

### New Capabilities

None. This change is test tooling and adds no system behavior.

### Modified Capabilities

None.

## Impact

- New dependency: `@playwright/test` (dev only) and its Chromium browser in CI.
- New files: `playwright.config.ts`, `e2e/**`, `app/__test__/` helpers, `app/__test__/setup.ts`.
- Modified: `vitest.config.ts`, `package.json` scripts, `.github/workflows/ci.yml`, `.gitignore`
  test artifacts if missing.
- No changes to routes, components, crypto, schema, or Worker bindings.
