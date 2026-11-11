# Tasks

## 1. 2FA step-up protection

- [x] 1.0 Add migration `0014_step_up_lockout.sql` with `step_up_failed_count` and `step_up_locked_until`.
- [x] 1.1 Add a shared step-up guard for enroll/disable/regenerate that reads `locked_until`, verifies the auth hash, records failures, resets on success, and returns locked/invalid/rate-limited statuses.
- [x] 1.2 Apply `limitIp('2fa-step-up')` and `limitIdentity('2fa-step-up', user.email)` before/after authentication in all three routes.
- [x] 1.3 Bump `session_version` after a successful factor change and reissue the current session cookie; return `sessionIssued:false` when issuance fails.
- [x] 1.4 Add route tests: 50 wrong proofs produce lockout/429 at the threshold, no attempt is lost, and a successful change revokes sibling sessions.
- [x] 1.5 Re-run the sandbox probe and verify HTTP 400 → 423/429 plus `failed_login_count`/`locked_until` changes.

## 2. Audit metadata

- [x] 2.1 Bind `event.metadata ?? null` instead of literal null in `insertAuditEvent`.
- [x] 2.2 Add tests asserting `targetUserId` and `invitationId` survive and that no credential/ciphertext field is accepted in metadata.
- [x] 2.3 Re-run the sandbox D1 probe and confirm the inserted admin row retains metadata.

## 3. Vault-key and outbox hardening

- [x] 3.1 Add `hasVaultKey()` and replace key-existence copies in sync/outbox; wipe the previous buffer in `setVaultKey`.
- [x] 3.2 Add strict item/folder/outbox payload schemas; validate payload, optimistic/previous rows at enqueue.
- [x] 3.3 Revalidate each persisted entry immediately before transport; rollback/drop invalid entries and emit error.
- [x] 3.4 Add tests for unwiped-copy call sites, flush-time plaintext injection, unknown fields, and corrupted optimistic rows.

## 4. Logout and restore

- [x] 4.1 Clear the key and start the IndexedDB wipe independently of logout success; keep the locked overlay and toast on failure.
- [x] 4.2 Add `data_ct <> '' AND data_iv <> ''` to the restore predicate and test that a purged item cannot be restored.
- [x] 4.3 Verify successful logout still revokes the session, wipes data, and navigates to login.

## 5. Build artifact secret gate

- [x] 5.1 Add `scripts/strip-build-secrets.ts` that removes `.dev.vars`/`.env*` under `build/` and fails if any remain.
- [x] 5.2 Change `build` and `deploy` scripts to use the gate; remove the unchecked `rm -f` from deploy.
- [x] 5.3 Add a unit test with a temporary build tree for deletion and fail-closed behavior.
- [x] 5.4 Verify `pnpm build` leaves no secret-bearing files and CI still passes.

## 6. Verification

- [x] 6.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
- [x] 6.2 Run focused sandbox tests for the 2FA and audit probes and the build-secret gate.
- [x] 6.3 Run `pnpm exec openspec validate security-audit-fixes --strict`.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
- Defer CSP, session-fingerprint enforcement, CI pinning, folder rev, sync cursor, and cron rev/audit to separate changes.
