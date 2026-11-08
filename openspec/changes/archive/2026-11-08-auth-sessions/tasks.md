# Tasks

## 1. Session version data model

- [x] 1.1 Add `migrations/0007_session_version.sql` with `session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0)`; verify the migration test applies it and an existing user reads back version 0
- [x] 1.2 Extend the schema test and test fixtures to assert the default and rejection of negative values; verify `pnpm test` covers both

## 2. Session store and fingerprints

- [x] 2.1 Add cookie parsing, `getSession(env, request)`, `destroySession(env, request)`, and `revokeUserSessions(env, userId)`; verify tests cover valid, missing, malformed, disabled, stale-version, and revoked sessions
- [x] 2.2 Extend `createSession` to store `{userId, createdAt, lastSeenAt, uaHash, ipHash, ver}` with an absolute 30-day KV expiration; verify tests assert the record shape, hash-only key, and fixed expiry
- [x] 2.3 Add hourly `lastSeenAt` refresh that preserves the absolute expiry; verify a second call within the hour performs no KV write and a later call updates only `lastSeenAt`
- [x] 2.4 Add peppered UA/IP fingerprint helpers using `SESSION_SECRET`; verify known-vector tests and null handling for missing headers

## 3. Auth lookup and verification

- [x] 3.1 Add constant-time auth-hash verification with base64url decoding and a dummy verify path for unknown emails; verify tests cover correct, wrong password, unknown email, and wrong-length hashes
- [x] 3.2 Add the uniform KDF lookup use-case returning stored or synthetic parameters with identical shape; verify tests compare known vs unknown response keys and status
- [x] 3.3 Add the login use-case returning the wrapped-key response or a generic failure; verify tests assert `requires2fa:false`, KDF fields, wrapped key fields, and no email echo

## 4. Auth API routes and audit

- [x] 4.1 Register `/auth/prelogin`, `/auth/login`, and `/auth/logout` as mutation-only routes; verify origin rejection, 256 KiB body cap, generic 401, and cookie headers through route tests or E2E
- [x] 4.2 Extend audit storage for nullable user ids and fingerprint fields, then emit `login.succeeded`, `login.failed`, and `logout`; verify tests assert event type, nullable user on unknown email, and no request content

## 5. Guards, header, and logout UI

- [x] 5.1 Add `requireUser` with safe `next` encoding, disabled-user rejection, and current-version checks; verify unit tests cover valid, missing, disabled, stale, and unsafe return targets
- [x] 5.2 Apply `requireConfigured` then `requireUser` to `/` and the protected layout; verify `/`, `/app`, and `/app/trash` redirect unauthenticated pages to login with the intended path, and `/login` redirects to `/setup` before bootstrap
- [x] 5.3 Resolve the optional session in the root loader and render identity + logout in `AppShell`; verify the sign-in fallback and logout request clear the session

## 6. Login page

- [x] 6.1 Build `/login` with email/password, KDF lookup, client auth-hash derivation, password clearing, generic errors, and `next` handling; verify the UI test or E2E covers the flow
- [x] 6.2 Unwrap `vaultKey` into the in-memory store and navigate to `next`/`/app`; verify no storage API is touched and a failed unwrap shows a retryable error
- [x] 6.3 Redirect `/login` to `next`/`/app` when a valid session already exists; verify with an authenticated request

## 7. E2E and documentation

- [x] 7.1 Change the setup spec to retain its admin and add an auth Playwright project that depends on setup; verify project order and isolated reset still work
- [x] 7.2 Add auth E2E coverage for login, `/app` access, logout, and the `next` return path with trace/screenshots disabled; verify `pnpm test:e2e` twice
- [x] 7.3 Update README with the login/session behavior, `next` handling, and logout; verify the documented commands run as written

## 8. Integration verification

- [x] 8.1 Run typecheck, lint, format check, unit tests, E2E, build, and OpenSpec validation; verify all pass with counts recorded
- [x] 8.2 Grep auth code for request-body logging, plaintext tokens, password echoes, and unauthorized D1 scoping; verify no secret reaches logs, cookies other than the session token, HTML, or storage

## Workflow follow-up

- Archive `setup-wizard` and `crypto-core` after their merged changes are verified.
- Run `/preflight` and fix every blocker before opening the PR.
- Open PR #9 with requirement IDs TASK-19 and TASK-20 and the security checklist.
