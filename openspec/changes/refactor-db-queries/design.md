# Design

## Context

See `proposal.md` — Why. The relevant constraints:

- D1 is accessed through `getDatabase(env)` in `app/lib/.server/db.ts`; there is no ORM.
- D1 prepared statements are built with `prepare(...).bind(...)`; `db.batch()` is the atomic multi-statement primitive.
- `AGENTS.md` already assigns raw SQL to `queries/`, but no query module exists.
- `app/lib/.server/session.ts`, `audit.ts`, `challenge.ts`, `bootstrap.ts`, and `complete-login.ts` are shared infrastructure imported by features, so they cannot depend on `app/server/`.
- `monev-dashboard` demonstrates the target shape: table query modules + `createXQueries(db)` factories consumed by use-cases, with no SQL in use-cases.

## Goals / Non-Goals

**Goals:**

- One query module per table group, owning SQL, row types, aliases, and statement construction.
- Use-cases and server libraries call named operations, not `prepare()`.
- Keep D1 handles injectable for tests without forcing every test through a route.
- Preserve atomic behavior for 2FA disable, backup-code regeneration, and challenge consumption.
- Establish a placement rule that avoids a future `app/lib -> app/server` dependency inversion.

**Non-Goals:**

- Adding Drizzle, Kysely, Prisma, or any ORM to the Worker runtime.
- Creating generic repositories, interfaces, base classes, or a unit-of-work abstraction.
- Changing schema, SQL semantics, indexes, migrations, or API responses.
- Moving session/complete-login into `app/server/auth`.
- Refactoring KV access; this change covers D1 queries only.

## Decisions

### D1. Table-oriented query modules with Env-bound factories

Each query module exports low-level functions that accept `D1Database`, plus a factory:

```ts
export const findUserByEmail = (db: D1Database, email: string) => ...;
export const createUsersQueries = (env: Env) => {
  const db = getDatabase(env);
  return { findByEmail: (email: string) => findUserByEmail(db, email) };
};
```

Use-cases and libraries call `createUsersQueries(env)` and never acquire the handle themselves.

Alternatives considered:

- Functions taking `db` only: minimal, but leaves `getDatabase(env)` in every caller, which is the current problem.
- Factory with a default `db = getDb()`: matches `monev-dashboard`, but Bridgewarden has no process-wide D1 singleton; the handle comes from `env`.
- Passing `db` from route to use-case: explicit, but routes should not know which tables a use-case reads.

### D2. Shared queries in `app/lib`, feature queries in `features`

Placement follows the dependency direction `features -> app/lib`:

- `app/lib/.server/queries/users.ts` — users table, used by session, login, 2FA, root, setup.
- `app/lib/.server/queries/user-two-factor.ts` — used by 2FA use-cases and the root loader; the login lookup joins this table through `users.ts`.
- `app/lib/.server/queries/audit-events.ts` — used by the audit library.
- `app/lib/.server/queries/two-factor-challenges.ts` — used by the challenge library and 2FA verification.
- `app/features/two-factor/.server/queries/backup-codes.ts` — one feature.
- `app/features/two-factor/.server/queries/two-factor-data.ts` — feature-owned batch delete across its two tables.

Alternative considered: put all auth queries in `app/server/auth/queries/`. Rejected because `app/lib/.server/session.ts` would have to import `app/server`, violating `app/server -> app/lib`. Moving session into `app/server` is a larger change and not required to remove SQL from call sites.

### D3. Query modules own row shapes and mapping

Row types and column aliases live beside the SQL:

```ts
type SessionUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  session_version: number;
};
```

Query modules own row types and column aliases. They may alias directly to the domain shape (session users do); otherwise callers map the row to their domain shape exactly once. Callers do not redeclare the same row type.

### D4. Batch operations stay inside the owning query module

D1 `batch()` is exposed only as a named operation:

- `createTwoFactorQueries(env).deleteAll(userId)` deletes `user_2fa` and `backup_codes` atomically.
- `replace(userId, codeHashes, now)` deletes and inserts backup-code hashes in one batch.
- `completeEnrollment(userId, step, now, codeHashes)` replaces codes and enables 2FA in one guarded batch.
- Challenge failure/consume operations remain single conditional statements inside the challenge query module.

The use-case never builds `D1PreparedStatement[]`; it calls the intent-level method.

Alternative considered: exposing statement builders and letting use-cases batch them. Rejected because it leaks D1 types and SQL ordering back into the use-case.

### D5. Migrate by call-site slice, not by table in isolation

Each commit moves all consumers of the affected queries so the tree stays type-safe:

1. Shared query modules and their low-level tests.
2. Shared libraries (`session`, `audit`, `challenge`, `complete-login`, `bootstrap`, root/health).
3. Login use-cases.
4. Two-factor use-cases and feature query modules.
5. Docs and full gate.

No commit leaves duplicated SQL in both a query module and its caller.

### D6. No repository abstraction

Query modules are concrete D1 modules. There are no interfaces, fakes, or dependency-injection containers. Tests pass `env.DB` to low-level functions or `twoFactorEnv()` to factories, matching the existing Workers-pool setup.

## Risks / Trade-offs

- [Factory hides the handle, making transactions less obvious] → multi-statement operations are named query methods, not arbitrary callbacks; the query module documents the batch boundary.
- [Query modules become a dumping ground] → split by table or cohesive table group; keep authority and business decisions in use-cases.
- [Row mapping moves and callers break] → migrate consumers in the same commit and keep row types exported from the module.
- [Shared queries in `app/lib` blur domain boundaries] → placement is limited to tables used by `app/lib` infrastructure; feature-only tables stay in `features/`.
- [D1 batch cannot be composed across factories] → the owning feature query module owns cross-table batch operations for its feature.
- [Behavior drift while moving SQL] → move statements verbatim first, keep tests, then clean up types; full E2E after each slice.

## Migration Plan

1. Add shared query modules and their tests; nothing imports them yet.
2. Move shared-library call sites and verify their unit tests.
3. Move login and two-factor use-case call sites; verify feature tests.
4. Update `AGENTS.md` and remove any dead helpers.
5. Run typecheck, lint, format, unit, E2E, and build.

Rollback: revert the refactor commits; no schema or data changes, so no compensating migration is needed.
