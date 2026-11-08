# Tasks

## 1. Dependencies and shared server helpers

- [x] 1.1 Confirm the merged PR #7 crypto modules exist under `app/lib/crypto/`; verify `pnpm typecheck` passes from merged `main` before starting
- [x] 1.2 Add `zod` to `package.json` and install it; verify `pnpm install` and `pnpm typecheck` succeed
- [x] 1.3 Add `app/lib/base64-url.ts` with canonical `toBase64Url` and `fromBase64Url`; verify `app/lib/__test__/base64-url.test.ts` covers padding, alphabet, round-trip, and rejection of non-canonical input
- [x] 1.4 Add `app/lib/.server/db.ts`, `request-origin.ts`, and `audit.ts`; verify tests cover the D1 handle, same-origin accept/reject, and the audit insert shape
- [x] 1.6 Add `app/lib/.server/auth-hash.ts` with 16-byte server salt and `HMAC-SHA256(AUTH_PEPPER, authHash || serverSalt)`; verify a fixed-vector test and a different-salt test both pass

## 2. Atomic bootstrap guard

- [x] 2.1 Add `app/lib/.server/bootstrap.ts` with `isBootstrapAvailable` and the single `INSERT … SELECT … WHERE NOT EXISTS` creation statement; verify tests show available/created on an empty table and 409-equivalent `changes === 0` on a populated table
- [x] 2.2 Store the admin with `role = 'admin'`, `status = 'active'`, zero counters, and the supplied KDF/wrapped-key fields; verify a test reads the row back and asserts every column
- [x] 2.3 Verify `Promise.all` of two `createFirstAdmin` calls yields exactly one row and one created result; verify the test fails if the guard is replaced by a count-then-insert

## 3. Session handoff

- [x] 3.1 Add `app/lib/.server/session.ts` with 32-byte token generation, SHA-256 KV key, `{ userId, createdAt }` record, and cookie serialization; verify tests assert the KV key is the token hash, destroy removes it, the raw token is absent from the value, and the cookie has `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and 30-day `Max-Age`

## 4. Input validation and server action

- [x] 4.1 Add `app/features/setup/.server/setup-input.ts` with a strict Zod schema and base64url byte-length checks for salt, keys, IVs, and `authHash`; verify tests cover valid input, lowercase email, short display name, malformed base64url, wrong sizes, unsafe iterations, and unknown keys
- [x] 4.2 Implement the `/setup` loader: available data when the table is empty, redirect to `/login` otherwise; verify via the E2E redirect scenario and a direct helper test
- [x] 4.3 Implement the `/setup` action in order: same-origin check, schema validation, token verification, auth-hash computation, atomic creation, audit event, session issuance; verify the use-case tests cover 403/409/500, missing pepper, KV failure, audit, and success with `Set-Cookie`
- [x] 4.4 Keep `app/routes/setup.tsx` transport-only and pass loader/action data into the feature entry; verify lint and review confirm no SQL, hashing, or token logic in the route

## 5. Client key generation and memory store

- [x] 5.1 Add `app/lib/vault/key-store.ts` with set/get/clear; verify tests assert the key is returned while set, absent after clear, returned as a copy, and that no storage API is touched
- [x] 5.2 Add `app/features/setup/setup-keys.ts` that derives and wraps all setup material; verify tests assert base64url transport values, decoded lengths, recovery round-trip, vault-key unwrap, and that no password or raw master key is returned
- [x] 5.3 Add the setup reducer/state machine with steps, password ≥12 validation, recovery confirmation, and retry state; verify pure-function tests cover every transition and confirm nothing is persisted
- [x] 5.4 Add every new setup string to `app/lib/i18n/en.ts`, including errors, 2FA warning, and recovery instructions; verify `pnpm typecheck` catches any missing key

## 6. Wizard UI

- [x] 6.1 Build the account and password steps with labelled inputs, inline errors, `aria-invalid`, and a strength meter exposing `role="progressbar"` and `aria-valuenow`; verify keyboard-only completion and the E2E flow
- [x] 6.2 Build the recovery-key display and six-character confirmation, showing the key once and clearing it after confirmation; verify the state test blanks the recovery key after confirmation and the E2E request body contains no recovery value
- [x] 6.3 Clear the password field immediately after derivation and block navigation with an in-app alert dialog plus `beforeunload` while key material exists; verify with the Playwright flow and a manual cancel check
- [x] 6.4 Submit through a fetcher, keep derived keys in memory on network failure, set the vault key and navigate to `/app` on success; verify the E2E landing page and that a reload leaves no key material in storage
- [x] 6.5 Build the informational two-factor step with the PRD warning, an explicit "enroll later" state, and no `user_2fa` write; verify the E2E skip path and the absence of a 2FA row
- [x] 6.6 Review the wizard at 360px, keyboard-only, and with a screen reader; verify labels, announced errors, focus after step changes, and no trapped focus after dialogs

## 7. E2E harness and documentation

- [x] 7.1 Add `e2e/global-setup.ts` that applies migrations and deletes users against `--local --persist-to .wrangler/e2e`; verify two consecutive `pnpm test:e2e` runs both start from an empty table
- [x] 7.3 Split Playwright projects into ordered `smoke` then `setup` with trace and screenshots disabled for setup; verify `pnpm test:e2e` runs both in that order
- [x] 7.4 Add `e2e/setup.spec.ts` covering successful wizard completion, `/app` landing, no key material after reload, and a follow-up `/setup` redirect; verify the spec passes twice in a row
- [x] 7.5 Update CI to generate throwaway `.dev.vars` values; verify the workflow never echoes values and `pnpm test:e2e` passes in the job
- [x] 7.6 Document first-run setup, the no-token first-visitor window, the local E2E reset, and the fact that setup is available only on an empty user table; verify the documented commands run as written

## 8. Integration verification

- [x] 8.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; verify every command passes with counts recorded
- [x] 8.2 Grep the new server and client code for logging, storage writes, and password echoes; verify no credential, auth hash, recovery value, or key material can reach logs, cookies other than the session token, HTML, or storage

## Workflow follow-up

- Run `/preflight` and fix every blocker before opening the PR.
- Open the PR for PR #8 with requirement TASK-18 and the security checklist.
- Archive the change after merge and verification.
