# Tasks

## 1. Invitation storage

- [x] 1.1 Add `migrations/0009_setup_invitations.sql` with the invitation table and indexes/constraints; verify migration tests and reset order include it.
- [x] 1.2 Add invitation token hashing/generation in `app/lib/.server/invitation-token.ts`; verify tests cover token length, hash-only storage, and no raw token logging.
- [x] 1.3 Add `app/features/admin-users/.server/queries/invitations.ts` with upsert, find-valid-by-hash, list-pending, consume, and revoke operations; verify query tests cover expiry, single use, and email conflict.

## 2. Shared setup key material

- [x] 2.1 Move `features/setup/setup-keys.ts` to `app/lib/crypto/setup-keys.ts` and update setup imports/tests; verify typecheck and setup tests pass.
- [x] 2.2 Add a member setup key generator that reuses the shared module and returns only transport material plus the in-memory vault key; verify the setup payload contains no password, recovery secret, or vault key.

## 3. Admin users

- [x] 3.1 Add `requireAdmin`/`requireAdminApi` guards; verify non-admin page 403, API 403, and unauthenticated 401/redirect behavior.
- [x] 3.2 Add admin list query/use-case merging users and pending invitations without secrets; verify tests exclude hashes, wrapped keys, seeds, and tokens.
- [x] 3.3 Add guarded disable, enable, revoke, and role-change query operations with last-active-admin SQL; verify 409 for the last admin and concurrent tests allow only one change.
- [x] 3.4 Add admin routes for list, invite, disable, enable, revoke, and role; verify each route is transport-only and origin/JSON guarded.
- [x] 3.5 Build `app/features/admin-users/` UI with status badges, pending invitation state, create dialog, and row actions; verify keyboard access and no secret fields in SSR/loader data.
- [x] 3.6 Add the admin-only shell navigation link; verify members do not see it.

## 4. Member setup

- [x] 4.1 Add `/setup/member` page/feature with token validation, password confirmation, and recovery confirmation; verify invalid/expired/consumed tokens render an error and create nothing.
- [x] 4.2 Add atomic invitation consumption plus user insertion in one D1 batch, with session compensation on failure; verify repeated submission creates one user.
- [x] 4.3 Apply the existing IP rate limit before member setup body parsing; verify 429 leaves the invitation pending.
- [x] 4.4 Issue a session and redirect to `/app` after setup; verify the raw token is not returned after completion and the invitation cannot be reused.

## 5. Tests and audit

- [x] 5.1 Emit audit events for invitation creation, member setup, role change, disable, enable, and revoke; verify no email, token, password, or key material appears.
- [x] 5.2 Add unit tests for invitations, admin guards, last-admin SQL, and member setup; verify all existing tests remain green.
- [x] 5.3 Add E2E for admin creates member, member sets up in a separate context, admin disables member, member is logged out; verify full suite passes.

## 6. Documentation and integration

- [x] 6.1 Update `README.md` with admin user management, invitation expiry/single-use, and member setup; verify no email delivery is implied.
- [x] 6.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; verify the suite remains green.
- [x] 6.3 Run `openspec validate admin-user-management --strict`; verify all artifacts are complete.

## Workflow follow-up

- Update `PR-PLAN.md` numbering for the split TASK-10 before opening the PR.
- Run `/preflight` before opening the pull request.
- Archive the change after merge.
