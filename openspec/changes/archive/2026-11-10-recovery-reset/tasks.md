# Tasks

## 1. Schema and crypto contract

- [x] 1.1 Add `migrations/0010_recovery_auth.sql` with nullable `recovery_auth_hash` and `recovery_server_salt` columns; verify the migration applies locally and existing rows keep both columns null.
- [x] 1.2 Add `recoveryAuth: 'bw-recovery-auth'` to `HKDF_INFO`; verify a crypto test proves the auth derivation differs from `bw-recovery` and is deterministic for the same recovery secret.

## 2. Client recovery crypto

- [x] 2.1 Add a `deriveRecoveryAuthKey(secret)` helper that returns a 32-byte proof and zeroes intermediate material; verify a test rejects a short or malformed recovery secret.
- [x] 2.2 Add a reset helper that takes the recovery key, current recovery wrapper/IV, and a new master password; verify it unwraps the same vault key, produces new auth/KDF/vault wrapper/recovery wrapper/proof values, and clears every key buffer.
- [x] 2.3 Verify the regenerated recovery key unwraps the vault under the new wrapper, the previous recovery key fails, and the previous recovery proof does not match the new proof.

## 3. Setup and member setup integration

- [x] 3.1 Extend setup and member-setup transport parsing with `recoveryAuthKey`; verify malformed lengths are rejected and the raw recovery secret is never present in the parsed payload.
- [x] 3.2 Persist the derived recovery verifier in `createFirstAdmin` and invitation acceptance; verify detail D1 tests read back non-null `recovery_auth_hash` and `recovery_server_salt` for new accounts.
- [x] 3.3 Update setup and member E2E fixtures to carry the new proof field; verify the existing setup and admin-user E2E flows still pass.

## 4. Recovery queries and use cases

- [x] 4.1 Add a recovery lookup query that returns the user id, status, recovery wrapper, and IV by normalized email; verify unknown and disabled accounts resolve to null without exposing password material.
- [x] 4.2 Add a recovery state query and a guarded reset query conditional on `id`, `status = 'active'`, `recovery_auth_hash`, and `recovery_server_salt`; verify a stale proof changes zero rows and a successful update increments `session_version` exactly once.
- [x] 4.3 Implement the lookup use case: for known active accounts return the stored wrapper/IV, and for unknown or disabled emails return deterministic pepper-derived synthetic values of the same shape; verify two requests for an unknown email return identical values and no auth/KDF fields.
- [x] 4.4 Implement the reset use case: verify the old proof with constant-time comparison, derive the new server hashes and salts, call the guarded reset, revoke old sessions via the version bump, issue a new session, and record `recovery.completed`; verify failures record `recovery.failed` with fingerprints only and do not change email, password, or recovery material.
- [x] 4.5 Verify disabled accounts, legacy accounts with null verifier columns, wrong proofs, and concurrent resets all return the same generic failure without credential mutation.

## 5. Routes and input validation

- [x] 5.1 Add `POST /auth/recover/lookup` with Origin, body cap, and IP/identity rate limits; verify known and unknown emails return the same status and field shape and no `Cache-Control` caching is allowed.
- [x] 5.2 Add `POST /auth/recover/reset` with Origin, body cap, rate limits, and strict length-validated base64url fields for the old proof, new auth material, vault wrapper, recovery wrapper, and new proof; verify malformed bodies return 400 and generic failures return 401 without `Set-Cookie`.
- [x] 5.3 Add the `GET /recover` page route and register all three routes in `app/routes.ts`; verify the page redirects authenticated users to the app and unconfigured installs to `/setup`.
- [x] 5.4 Verify a successful reset returns a new session cookie, `Cache-Control: no-store`, and no recovery secret, vault key, auth hash, or proof in the body.

## 6. Recovery UI and copy

- [x] 6.1 Create `app/features/recover/` with a thin page entry, a container that owns the flow hook, and components for email lookup, recovery-key entry, forced new password, success, and the one-time new recovery key display.
- [x] 6.2 Implement the client flow: lookup, parse recovery key, unwrap, derive new material, reset, keep the vault key in memory, display the new recovery key exactly once, and clear password/key buffers on every exit path.
- [x] 6.3 Add i18n keys for labels, generic failures, rate limiting, success, and recovery-key warnings; verify no string is hardcoded and the wrong-key message does not reveal account existence.
- [x] 6.4 Verify the form has accessible labels, `aria-invalid` plus visible errors, a busy state, no double submit, and a working keyboard-only path.

## 7. End-to-end and verification

- [x] 7.1 Add an E2E flow that saves a setup recovery key, resets the password with it, logs in with the new password, confirms the old password fails, and confirms the old recovery key is rejected on a second reset attempt.
- [x] 7.2 Add an E2E assertion that a second browser session is forced back to `/login` after the reset, while the resetting browser reaches `/app` without re-login.
- [x] 7.3 Verify legacy behavior with a test user whose recovery verifier columns are null: lookup returns the synthetic shape and reset returns the generic failure without mutation.
- [x] 7.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, and `pnpm exec openspec validate recovery-reset --strict`; verify all pass.
- [x] 7.5 Update `README.md` with the recovery flow, the legacy-account limitation, and the fact that recovery key regeneration is required before pre-migration accounts can recover.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
- Defer TASK-28 auto-lock until TASK-13 supplies the encrypted vault cache.
