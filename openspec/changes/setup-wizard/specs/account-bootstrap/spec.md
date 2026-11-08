# Spec Delta

## Purpose

Defines how a fresh deployment gets its first administrator safely: a one-time availability gate,
atomic creation, browser-side key generation, recovery-key
confirmation, and a session handoff that never exposes vault key material to the server.

## ADDED Requirements

### Requirement: Setup availability gate

The setup surface SHALL be available only while the `users` table is empty. A GET request to
`/setup` when at least one user exists SHALL redirect to `/login` and MUST NOT render the wizard. A
POST request that loses the creation race SHALL respond with 409 and create no row.

#### Scenario: Fresh deployment opens the wizard
- **WHEN** a user requests `/setup` and the `users` table is empty
- **THEN** the response is 200 and renders the first wizard step

#### Scenario: Configured deployment redirects away
- **WHEN** a user requests `/setup` and at least one user exists
- **THEN** the response redirects to `/login` and does not render the wizard

#### Scenario: Losing a concurrent request returns 409
- **WHEN** a POST reaches `/setup` after another request created the first admin
- **THEN** the response is 409, no additional user row is created, and no session is issued

### Requirement: Unconfigured route guard

While the `users` table is empty, requests to `/` and to `/app/*` SHALL redirect to `/setup` so the
operator cannot land in a shell that assumes an existing account.

#### Scenario: Home redirects before setup
- **WHEN** a visitor requests `/` while no user exists
- **THEN** the response redirects to `/setup`

#### Scenario: Vault routes redirect before setup
- **WHEN** a visitor requests `/app` or `/app/trash` while no user exists
- **THEN** the response redirects to `/setup`

### Requirement: Atomic first-admin creation

The server SHALL create the first administrator with a single
`INSERT INTO users … SELECT … WHERE NOT EXISTS (SELECT 1 FROM users)` statement and MUST treat
`meta.changes` of 0 as 409. A separate count-then-insert check MUST NOT be the guard. The created row
SHALL have `role = 'admin'` and `status = 'active'`.

#### Scenario: Two concurrent requests create one admin
- **WHEN** two setup POSTs with valid input run concurrently against an empty table
- **THEN** exactly one user row exists and exactly one response reports success

#### Scenario: Refresh during the wizard creates no user
- **WHEN** the wizard is reloaded before the final submission
- **THEN** no user, audit event, or session is created

### Requirement: Setup account input

The wizard SHALL collect an email address, a display name, and a master password entered twice. The
email SHALL be trimmed and lowercased before storage and MUST be unique regardless of case. The
master password MUST be at least 12 characters, the confirmation MUST match exactly, and both are
evaluated only in the browser; neither MUST be submitted.

#### Scenario: Valid account details are accepted
- **WHEN** the user submits a valid email, a non-empty display name, and a 12-character password
- **THEN** the wizard advances to recovery-key confirmation

#### Scenario: Short password blocks progress
- **WHEN** the master password is shorter than 12 characters
- **THEN** the wizard shows an inline error and does not generate keys

#### Scenario: Mismatched password confirmation blocks progress
- **WHEN** the confirmation does not exactly match the master password
- **THEN** the wizard shows an inline error and does not generate keys

#### Scenario: Invalid email is rejected by the server
- **WHEN** a POST contains a malformed email or an empty display name
- **THEN** the response is 400 and no user row is created

### Requirement: Browser-side key generation

On master-password submission the browser SHALL generate a 16-byte `kdfSalt`, derive `masterKey` and
`authHash`, generate a 32-byte `vaultKey`, wrap it with the wrap key, generate a 16-byte recovery
secret, and wrap the same `vaultKey` with the recovery key. Only derived and wrapped values, the KDF
parameters, and the salts SHALL be submitted. The password, `masterKey`, `vaultKey`, and recovery
secret MUST NOT leave the browser.

#### Scenario: Only derived values reach the network
- **WHEN** the wizard submits the final step
- **THEN** the request contains wrapped keys, salts, iterations, email, and display name, and no password or unwrapped key

#### Scenario: Password state is cleared after derivation
- **WHEN** key derivation completes
- **THEN** the password field is empty and the plaintext password is no longer held by the wizard

### Requirement: Binary transport encoding

Setup requests SHALL carry binary values as unpadded base64url. The server MUST reject malformed or
oversized fields and SHALL store standard padded base64 in D1. Stored values MUST pass the crypto
contract's decoded length requirements.

#### Scenario: Base64url values are normalized for storage
- **WHEN** a POST submits valid unpadded base64url values
- **THEN** the stored `kdf_salt`, wrapped keys, and IVs are standard padded base64

#### Scenario: Malformed or wrong-sized values are rejected
- **WHEN** a field is not valid base64url or decodes to the wrong length
- **THEN** the response is 400 and no user row is created

### Requirement: Server-side authentication hash

The server SHALL generate a random `serverSalt` and store
`auth_hash = HMAC-SHA256(AUTH_PEPPER, authHash || serverSalt)`. The raw client `authHash` MUST NOT be
stored in plaintext or logged. Both salts SHALL be stored as standard padded base64.

#### Scenario: Stored hash is peppered
- **WHEN** setup creates a user
- **THEN** the stored `auth_hash` differs from the submitted `authHash` and cannot be verified without `AUTH_PEPPER`

#### Scenario: Missing pepper fails closed
- **WHEN** `AUTH_PEPPER` is absent
- **THEN** setup returns a server error and creates no user row

### Requirement: Recovery key display and confirmation

The wizard SHALL display the formatted 26-character recovery key exactly once and require the user
to type back the first six normalized characters before completion. The displayed key SHALL be copyable and
downloadable as a text file through explicit user actions. The recovery key MUST NOT be submitted to
the server, written to browser storage, or included in logs, and it SHALL be discarded from memory
after confirmation.

#### Scenario: Mismatched confirmation blocks completion
- **WHEN** the typed-back characters do not match the displayed key
- **THEN** the wizard shows an inline error and does not submit

#### Scenario: User saves the recovery key
- **WHEN** the user copies or downloads the displayed recovery key
- **THEN** the clipboard or downloaded file contains the same formatted key and no network request is made

#### Scenario: Confirmed recovery key is never sent
- **WHEN** the user confirms the recovery key and submits
- **THEN** the request body contains no recovery key or recovery secret

### Requirement: Setup completion session handoff

On successful creation the server SHALL set an httpOnly, Secure, SameSite=Lax, Path=/ `bw_session`
cookie valid for 30 days, backed by a 32-byte random token whose SHA-256 hash is stored in
`KV_SESSIONS`. The browser SHALL keep the unwrapped vault key only in memory and SHALL navigate to
`/app` without persisting key material.

#### Scenario: Successful setup issues a session
- **WHEN** the first admin is created
- **THEN** the response sets `bw_session` and the client transitions to `/app`

#### Scenario: Reload after setup locks the vault
- **WHEN** the user reloads `/app` after setup
- **THEN** no vault key is recovered from storage and the vault requires a fresh unlock

### Requirement: Bootstrap audit event

A successful bootstrap SHALL write one `audit_events` row with type `bootstrap.created` referencing
the new user. The event metadata MUST NOT contain credentials, tokens, ciphertext, or vault content.

#### Scenario: Admin creation is audited
- **WHEN** the first admin is created
- **THEN** exactly one `bootstrap.created` audit event references that user

#### Scenario: Failed attempts are not audited as success
- **WHEN** a setup request fails validation or the atomic guard
- **THEN** no `bootstrap.created` event is written

### Requirement: Optional two-factor handoff

The wizard SHALL offer an informational two-factor step with the PRD warning text. Until enrollment
ships, continuing from it MUST NOT block completion and MUST NOT create a partial 2FA row.

#### Scenario: Skipping two-factor completes setup
- **WHEN** the user skips the optional two-factor step
- **THEN** the account is created without a `user_2fa` row and the wizard completes

#### Scenario: Informational two-factor step does not block setup
- **WHEN** the user continues from the two-factor step before enrollment exists
- **THEN** the account is created, no 2FA row is written, and the user is told to enroll later

### Requirement: Same-origin mutation

Every setup POST MUST validate the request `Origin` against the application origin and SHALL reject a
foreign or missing origin with a 4xx response before reading the body or writing data. React Router
may abort with 400 before the route action; the action itself returns 403.

#### Scenario: Foreign origin is rejected
- **WHEN** a POST arrives with an `Origin` that does not match the application origin
- **THEN** the response is 4xx (400 from React Router or 403 from the action) and no user or audit row is created
