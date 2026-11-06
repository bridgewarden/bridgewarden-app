# Tasks

## 1. Users migration

- [x] 1.1 Create `migrations/0002_users.sql` with the columns, `COLLATE NOCASE UNIQUE` email, and CHECK constraints from `TASK-7`, without a duplicate email index. Verify the migration applies by running `pnpm test app/__test__/migrations.test.ts` and the applied names equal the files on disk.
- [x] 1.2 Add `app/__test__/schema-users.test.ts` covering case-insensitive duplicate rejection, zeroed `vault_rev`/`failed_login_count`, allowed role/status values, and a check that the `users` table SQL contains no plaintext password or key column. Verify the tests pass.

## 2. Folders and vault items

- [x] 2.1 Create `migrations/0003_vault.sql` with `folders` before `vault_items`, foreign keys to `users` and `folders`, the four vault indexes, and the folders user index. Verify the migration applies and the expected index names exist in `sqlite_master`.
- [x] 2.2 Add `app/__test__/schema-vault.test.ts` covering the `type` check, revision increase on update, tombstone behavior, ciphertext-only columns (no name/username/password/notes columns), and folder deletion detaching items. Verify the tests pass.

## 3. Two-factor persistence

- [x] 3.1 Create `migrations/0004_two_factor.sql` with `user_2fa` (encrypted seed, enabled, last step) and `backup_codes` (unique hash, used marker) plus the `(user_id, used_at)` index. Verify the migration applies.
- [x] 3.2 Add `app/__test__/schema-two-factor.test.ts` covering the one-row-per-user constraint, seeded `last_totp_step`, hash uniqueness, and single-use marking. Verify the tests pass.

## 4. Audit events

- [x] 4.1 Create `migrations/0005_audit.sql` with the nullable user reference (`ON DELETE SET NULL`), type, hashed network identifiers, metadata, timestamp, and the `(user_id, created_at)` index. Verify the migration applies.
- [x] 4.2 Add `app/__test__/schema-audit.test.ts` covering the null user after deletion and that the table has no column intended for credentials or vault content. Verify the tests pass.

## 5. Dormant organizations

- [x] 5.1 Create `migrations/0006_orgs_dormant.sql` with `orgs`, `org_members` (role check), `collections`, and `collection_items`, each with its foreign keys, plus a header comment marking them unused in the MVP. Verify the migration applies.
- [x] 5.2 Add `app/__test__/schema-orgs.test.ts` covering the four tables, the role check, and composite membership/collection-item keys. Verify the tests pass, and confirm no route or feature module references the tables.

## 6. Harness alignment

- [x] 6.1 Extend `DELETE_ORDER` in `app/__test__/reset-database.ts` to `collection_items, collections, org_members, orgs, vault_items, folders, backup_codes, user_2fa, audit_events, users`. Verify the `DELETE_ORDER` coverage test in `reset-database.test.ts` passes with the nine new tables.
- [x] 6.2 Confirm `migrations.test.ts` compares the five new migration names, and that `resetDatabase` still empties seeded rows without dropping tables. Verify `pnpm test` passes.

## 7. Apply and verify

- [x] 7.1 Run `pnpm db:migrate:local`, then inspect `sqlite_master` for all ten tables and the required indexes; run `pnpm db:reset:local` and re-apply to prove a fresh database works. Verify no errors and the expected table list.
- [x] 7.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; confirm every command exits 0.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Open the PR with change id `database-schema` and requirements `TASK-7` … `TASK-12`.
- Archive the change after the PR is merged.
