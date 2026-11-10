# Tasks

## 1. Server rotation

- [x] 1.1 Add password-rotation input parsing in `app/features/account-settings/.server/` with strict length/iteration checks; verify malformed auth hashes, salts, wrapped keys, and IVs are rejected.
- [x] 1.2 Add `rotatePassword` to `app/lib/.server/queries/users.ts` as one guarded update that changes auth/KDF/wrapped-key fields, clears lockout state, and increments `session_version`; verify the old password fails and the new password works in query tests.
- [x] 1.3 Add `POST /api/account/password` that resolves the session, verifies `currentAuthHash`, applies the update, and maps wrong proof/disabled/DB failure without partial changes; verify route tests cover success, wrong proof, and malformed input.

## 2. Session reissue

- [x] 2.1 Reread the new session version after rotation, create a replacement KV session, delete the old token, and return the new cookie; verify the current device continues and a second session is rejected.
- [x] 2.2 Handle KV failure after the D1 update by returning `server-error` without claiming success; verify the old session is already invalid and a new login succeeds.

## 3. Client rewrap

- [x] 3.1 Add `app/lib/crypto/password-change.ts` that derives the current master/wrap keys, unwraps the vault key, derives the new master/wrap/auth material, and re-wraps the same vault key; verify crypto tests cover success, wrong current password, and that the vault key round-trips unchanged.
- [x] 3.2 Clear passwords and derived key copies on every success/failure path; verify no vault key or password is written to storage.

## 4. Settings UI

- [x] 4.1 Extend the settings loader with the authenticated user's public KDF salt, iteration count, and email; verify no vault key, auth hash, or recovery material is returned.
- [x] 4.2 Add the password card to `features/account-settings` with current/new/confirm fields, validation, busy state, and accessible errors; verify keyboard and screen-reader behavior.
- [x] 4.3 Wire successful rotation to keep the in-memory vault key and update local form state without navigation; verify the current device remains signed in and the old password fails on a fresh login.

## 5. Tests

- [x] 5.1 Add unit tests for rotate-query atomicity, wrong current auth hash, disabled account, and old/new password transitions; verify existing auth suites remain green.
- [x] 5.2 Add route tests for 401 wrong proof, 400 invalid input, 401 unauthenticated, and 200 with a new cookie; verify `Set-Cookie` and no secret fields in the body.
- [x] 5.3 Add E2E: change password → logout → new password works → old password fails; verify a second browser context is forced back to login.
- [x] 5.4 Confirm recovery-key unwrap still works after a password change; verify with a crypto test using material generated at setup.

## 6. Documentation and integration

- [x] 6.1 Update `README.md` with password rotation behavior and the recovery key remaining valid; verify no recovery secret or password appears in examples.
- [x] 6.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; verify the suite remains green.
- [x] 6.3 Run `openspec validate change-master-password --strict`; verify all artifacts are complete.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
