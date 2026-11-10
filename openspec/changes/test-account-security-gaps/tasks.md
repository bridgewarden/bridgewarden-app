# Tasks

## 1. Test fixtures for authenticated rotation

- [x] 1.1 Add a test helper that creates an active or disabled user with real setup key material, stores the server auth hash, and exposes the transport values needed by the password-change route; verify the helper inserts a row readable through `findPasswordChangeState`.
- [x] 1.2 Add a helper that creates a KV session for the user and returns the request cookie; verify the route accepts the cookie and the success case returns a working session.

## 2. Use-case coverage

- [x] 2.1 Add `app/features/account-settings/__test__/change-password.test.ts` covering a disabled account, a missing account, and a wrong current auth hash; verify each returns `invalid-current` and leaves `auth_hash`, `kdf_salt`, and `vault_key_wrapped` unchanged.
- [x] 2.2 Cover the successful path and a stale expected credential: verify `rotatePassword` returns one change on the current snapshot, zero changes for the pre-rotation snapshot, and increments `session_version` only once.

## 3. Route coverage with a real session

- [x] 3.1 Extend `app/routes/__test__/password-route.test.ts` with a wrong-current-proof request carrying a valid session cookie; verify 401, no `Set-Cookie`, and no user-row mutation.
- [x] 3.2 Add the success case with a valid cookie and valid new material; verify 200, `Set-Cookie` with a new session token, `Cache-Control: no-store`, and a response body without auth hashes, wrapped keys, or KDF material.
- [x] 3.3 Verify a request whose session version no longer matches the user row is rejected with 401 before password verification.

## 4. Recovery-key preservation

- [x] 4.1 Extend `app/lib/crypto/__test__/password-change.test.ts` to generate setup material, rotate the password with `rewrapPassword`, and unwrap the untouched recovery wrapper with the original recovery key; verify the unwrapped value equals the original vault key.
- [x] 4.2 Verify the old password wrapper cannot be unwrapped with the new wrap key and the old password no longer reproduces the new auth hash.

## 5. Verification

- [x] 5.1 Run the focused test files and confirm each case asserts the relevant status plus the absence of credential mutation.
- [x] 5.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; verify the suite remains green with the new tests included.
- [x] 5.3 Confirm `openspec/changes/change-master-password/tasks.md` 5.1, 5.2, and 5.4 now describe tests that actually exist.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after the tests merge.
