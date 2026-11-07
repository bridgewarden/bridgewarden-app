# Proposal

## Why

The repository has no tables yet, only a comment-only baseline migration. Every later PR —
crypto setup, login and sessions, vault API, offline cache — depends on a stable storage contract.
The test harness now applies `migrations/` to an isolated D1 instance and fails if a migrated table
is missing from `resetDatabase`'s delete order, so the schema cannot land without touching that
order in the same change.

## What Changes

- Add five forward-only migrations:
  - `0002_users.sql`
  - `0003_vault.sql` (`folders` before `vault_items`)
  - `0004_two_factor.sql`
  - `0005_audit.sql`
  - `0006_orgs_dormant.sql`
- Define the columns, checks, and indexes from `TASK-7` … `TASK-12` in the PRD: identity and
  wrapped keys, ciphertext-only vault items and folder names, 2FA seed ciphertext with replay
  state, hashed single-use backup codes, audit events without secrets, and dormant organization
  tables.
- Extend `DELETE_ORDER` in `app/__test__/reset-database.ts` to all ten tables, children first, so
  the existing coverage test passes and cascade deletes stay valid.
- Add schema tests for case-insensitive email uniqueness, cascade and detach behavior, check
  constraints, required indexes, dormant tables, and migration names.
- Record two deliberate corrections to the task text: a single unique email index instead of a
  duplicate column constraint plus index, and `folders` created before `vault_items` so the foreign
  key target exists first.

Out of scope: query helpers, API handlers, seed data, routes, organization behavior, and any
plaintext vault column.

## Capabilities

### New Capabilities

- `data-model`: the durable storage contract — user identity and wrapped key material, ciphertext
  vault items and folders, 2FA persistence, audit events, dormant organization tables, and the
  referential integrity rules between them.

### Modified Capabilities

None.

## Impact

- `migrations/0002` … `0006`, `app/__test__/reset-database.ts`, and new tests under
  `app/__test__/`.
- Local D1 gains tables after `pnpm db:migrate:local`; the isolated test database and
  `.wrangler/e2e` stay empty until their migration steps run.
- No route, component, crypto, or Worker binding changes.
