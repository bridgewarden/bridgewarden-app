# Proposal

## Why

Production code has roughly 70 raw D1 statements spread across use-cases, route modules, and server libraries. Use-cases currently mix authorization and business decisions with SQL, row shapes, column aliases, and batch construction. This makes review harder, duplicates row types, and leaves no single place to inspect the queries for a table. The project already documents a `queries/` layer in `AGENTS.md`, but no query module exists.

## What Changes

- Introduce table-oriented query modules for D1:
  - Shared infrastructure tables used by `app/lib` plus multiple features move to `app/lib/.server/queries/`.
  - Tables owned by one feature move to `features/<feature>/.server/queries/`.
- Each query module owns SQL, row types, column-to-camelCase mapping, and prepared-statement construction.
- Each module exposes:
  - Low-level functions that accept `D1Database`, for tests and explicit composition.
  - A factory such as `createUsersQueries(env)` that acquires the D1 handle through `getDatabase(env)`.
- Use-cases and server libraries stop calling `getDatabase()` or writing SQL; they call query factories and receive typed results.
- Multi-statement operations remain inside the owning query module:
  - disabling 2FA batches `user_2fa` and `backup_codes` deletion.
  - regenerating backup codes batches delete plus inserts.
  - challenge attempt/consume updates stay atomic in the challenge query module.
- Update `AGENTS.md` to document the shared-versus-feature query placement rule and the no-SQL-outside-`queries/` rule.
- **BREAKING** none. Routes, APIs, database schema, and user-visible behavior remain unchanged.

## Capabilities

### New Capabilities

None. This is a structural refactor with no externally observable behavior change.

### Modified Capabilities

None. Existing data-model and auth behavior stay the same.

## Impact

- New query modules under `app/lib/.server/queries/` and `app/features/two-factor/.server/queries/`.
- Changes to login, setup, two-factor, session, audit, challenge, bootstrap, root loader, and health route call sites.
- Updated tests that currently import helper functions which move into query modules.
- No migrations, no dependency additions, no API contract changes.
- Full typecheck, lint, unit, E2E, and build must stay green.
