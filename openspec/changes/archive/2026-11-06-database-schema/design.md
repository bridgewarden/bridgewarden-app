# Design

## Context

See proposal.md — Why. Current state that shapes the schema:

- `migrations/` contains only `0001_noop.sql`; no tables exist.
- The Vitest harness applies every migration to an isolated D1 instance per test file and exposes
  `d1Migrations` plus `schemaTables` (parsed from `CREATE TABLE` statements).
- `resetDatabase` deletes rows in a fixed `DELETE_ORDER`; a test fails if a migrated table is not in
  that list. D1 rejects `PRAGMA foreign_keys = OFF` and `PRAGMA foreign_key_list` with `SQLITE_AUTH`,
  so ordering must be explicit and verified through real deletes.
- Timestamps in the PRD are integer epoch milliseconds; SQLite defaults would be seconds.
- `vault_items.org_id` is plain metadata in the MVP; organization behavior is phase 2.

## Goals / Non-Goals

**Goals:**

- Forward-only migrations that a fresh local and test database can apply in order.
- Ciphertext-only storage for every vault field that the server must not read.
- Referential behavior (cascade, detach, null) that is proven by tests, not assumed.
- A `DELETE_ORDER` that matches the schema and fails loudly when a table is added without updating it.

**Non-Goals:**

- Query helpers, DTOs, API handlers, seed data, or routes.
- Organization behavior; only the dormant tables are created.
- Encrypting or validating ciphertext contents; the server stores opaque blobs.
- Enforcing per-user revision monotonicity in SQL; that stays an application rule.
- Adding `UNIQUE(user_id, rev)` or a JSON check on audit metadata; the task does not ask for them.

## Decisions

### D1. Five migrations in dependency order

`0002_users` → `0003_vault` (`folders`, then `vault_items`) → `0004_two_factor` →
`0005_audit` → `0006_orgs_dormant`.

Alternatives: one schema file (harder to review and to roll forward) or per-table files (more
files than needed). Five files group one domain each and keep the foreign-key targets available
before their dependents.

### D2. Single unique email index

Use `email TEXT NOT NULL COLLATE NOCASE UNIQUE` and do not add a second
`CREATE UNIQUE INDEX idx_users_email`. The column constraint already creates an index; a duplicate
adds write cost without benefit. This intentionally corrects `TASK-5`, which lists both.

### D3. Folders before vault items

`folders` is created before `vault_items` so the `folder_id` foreign key target exists first. This
reverses the order in the task text but not the schema.

### D4. Explicit delete order, guarded by a test

`DELETE_ORDER` becomes `collection_items, collections, org_members, orgs, vault_items, folders,
backup_codes, user_2fa, audit_events, users` — children before parents. The existing coverage test
parses `schemaTables` and fails if any migrated table is missing, so PR #6 cannot silently drift.

### D5. `org_id` stays plain metadata

`vault_items.org_id` is a nullable TEXT column without a foreign key, matching the task. The dormant
organization tables are created last. When organizations are activated, a migration can rebuild the
table or enforce ownership in the application; no MVP data depends on it.

### D6. Timestamps are application-supplied

Every `created_at`/`updated_at` is `INTEGER NOT NULL` with no SQL default. The application writes
epoch milliseconds, matching the PRD and avoiding SQLite's second-resolution defaults.

### D7. Check constraints now, rebuilds later

`type`, `role`, `status`, and `favorite` use CHECK constraints. SQLite cannot add a value to a CHECK
without rebuilding the table, which is accepted for the MVP (`login`/`note`, `admin`/`member`,
`active`/`disabled`). Future item types will ship with a rebuild migration.

### D8. No revision uniqueness constraint

`rev` is a per-user monotonic value allocated by the API, but the schema does not add
`UNIQUE(user_id, rev)` because the task does not require it and folder operations may assign several
revisions. The API PR owns that invariant.

### D9. Verify foreign keys with real deletes

D1 enforces declared foreign keys, but the PRAGMA introspection needed to inspect them is blocked.
Tests delete a user and a folder and assert the resulting rows, rather than trusting the schema text.

### D10. Test coverage

- Email uniqueness across letter case.
- New-account defaults and constrained role/status.
- Item type check, revision and tombstone behavior, ciphertext-only columns.
- Folder deletion detaches items; user deletion cascades items, folders, 2FA, and backup codes and
  nulls audit references.
- Required indexes present in `sqlite_master`.
- Migration names match the files the harness applied.
- Dormant tables exist and no route references them.
- `DELETE_ORDER` covers every parsed schema table.

## Risks / Trade-offs

- [`COLLATE NOCASE` is ASCII-only] -> The application lowercases and normalizes emails before
  insert; the constraint is defense in depth.
- [CHECK enum changes need a table rebuild] -> Accepted; phase 2 item types ship with their own
  migration.
- [Hard-coded `DELETE_ORDER`] -> The coverage test fails when a table is added without it; order
  itself is proven by cascade tests.
- [Dormant tables count as scope] -> They are explicitly in the requirement; no route or code reads
  them.
- [Migrations never applied to `.wrangler/e2e`] -> E2E does not touch these tables yet; the auth PR
  must apply migrations to the isolated E2E database.
- [Foreign keys on a fresh D1] -> A failed migration leaves earlier files applied; migrations are
  forward-only and applied with Wrangler.

## Migration Plan

- Local: `pnpm db:migrate:local`; `pnpm db:reset:local` recreates the database from scratch.
- Tests: the existing global setup applies new files automatically; `resetDatabase` covers the new
  tables.
- Production: not deployed in this change; remote migrations are applied in the release PR.
- Rollback: revert the migration files and recreate the local database; no production data depends
  on them yet.
