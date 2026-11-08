# user-auth Specification

## Purpose
Defines password login, opaque server sessions, route protection, logout, and revocation so a
previously bootstrapped account can sign in and stay authenticated without exposing vault secrets.

## Requirements

### Requirement: Uniform KDF parameter lookup

The login lookup SHALL return KDF parameters with the same shape and status for known and unknown
emails. Unknown emails SHALL receive deterministic synthetic parameters derived from the configured
pepper so the response cannot reveal account existence. The lookup MUST NOT include credentials,
wrapped keys, or session state.

#### Scenario: Known email lookup
- **WHEN** a client submits an email that exists
- **THEN** the response contains that account's KDF algorithm, salt, and iteration count with status 200

#### Scenario: Unknown email lookup
- **WHEN** a client submits an email that does not exist
- **THEN** the response has the same status and field shape with synthetic KDF parameters

#### Scenario: Lookup is case-insensitive
- **WHEN** an email is submitted with different letter case
- **THEN** the lookup resolves to the same account or synthetic identity

### Requirement: Credential verification

The server SHALL verify the submitted client `authHash` with `HMAC-SHA256(AUTH_PEPPER, authHash ||
serverSalt)` and a constant-time comparison. Unknown email and wrong password MUST return the same
401 status and body. The request body MUST NOT be logged.

#### Scenario: Correct credentials
- **WHEN** a known email and matching `authHash` are submitted
- **THEN** the request proceeds to session issuance

#### Scenario: Unknown email
- **WHEN** an unknown email is submitted with any hash
- **THEN** the response is the generic 401

#### Scenario: Wrong password
- **WHEN** a known email is submitted with a non-matching `authHash`
- **THEN** the response is the generic 401

### Requirement: Login response and client unlock

A successful login SHALL return only `requires2fa`, the account's KDF parameters, and the wrapped
vault key with its IV. The browser SHALL derive the wrap key, unwrap the vault key into memory, clear
the master password, and navigate to the validated `next` path or `/app`. The vault key MUST NOT be
written to storage or a cookie.

#### Scenario: Unlocked landing page
- **WHEN** login succeeds
- **THEN** the response contains wrapped key material and the browser lands on the requested app route with an in-memory vault key

#### Scenario: Password cleared
- **WHEN** the client finishes unwrapping
- **THEN** the password and derived key material are no longer held by the form

### Requirement: Session issuance and lifetime

Successful login SHALL issue a 32-byte random token stored only as its SHA-256 hash in KV, set an
`HttpOnly; Secure; SameSite=Lax; Path=/` cookie valid for 30 days, and record
`{userId, createdAt, lastSeenAt, uaHash, ipHash, ver}`. The lifetime SHALL be absolute; activity
updates `lastSeenAt` but MUST NOT extend expiry.

#### Scenario: Cookie and KV shape
- **WHEN** a session is issued
- **THEN** the cookie carries the required attributes and KV stores only the token hash with metadata

#### Scenario: Activity does not extend lifetime
- **WHEN** a session is refreshed after the hourly threshold
- **THEN** only `lastSeenAt` changes and the absolute expiry stays fixed

### Requirement: Session resolution

The server SHALL resolve a session from the cookie, KV record, and user row, rejecting a missing,
malformed, expired, disabled, or version-mismatched session. A session version mismatch MUST be
treated as revoked even when its KV entry still exists.

#### Scenario: Valid session
- **WHEN** an active user presents a session with the current version
- **THEN** the request is authenticated as that user

#### Scenario: Disabled user
- **WHEN** a session belongs to a disabled user
- **THEN** the request is unauthenticated

#### Scenario: Stale version
- **WHEN** a session version differs from the user's current session version
- **THEN** the request is unauthenticated even if KV still holds the record

### Requirement: Route protection

`/` and `/app/*` SHALL require an authenticated session after the empty-table setup guard. Before
setup, `/`, `/app/*`, and `/login` SHALL redirect to `/setup`. Unauthenticated page requests MUST
redirect to `/login?next=<same-origin path>`; `next` MUST be a single-leading-slash path and foreign
or protocol-relative targets are discarded. API handlers SHALL return 401 instead of redirecting.

#### Scenario: Unauthenticated app request
- **WHEN** a visitor without a session requests `/app/trash?x=1`
- **THEN** the response redirects to login with the encoded same-origin return path

#### Scenario: Unauthenticated home request
- **WHEN** a visitor without a session requests `/` after setup
- **THEN** the response redirects to login with `/` as the return path

#### Scenario: Login before setup
- **WHEN** a visitor requests `/login` while the users table is empty
- **THEN** the response redirects to `/setup`

#### Scenario: Unsafe next target
- **WHEN** the login page receives a protocol-relative or foreign `next` value
- **THEN** it ignores the value and uses the default app route

#### Scenario: Missing session on API
- **WHEN** a future API handler is called without a valid session
- **THEN** it responds 401 instead of redirecting

### Requirement: Logout

`POST /auth/logout` SHALL delete the current session record, clear the session cookie, and emit a
logout audit event. Repeating logout without a session MUST still succeed and clear the cookie.

#### Scenario: Logout invalidates the session
- **WHEN** a logged-in user logs out
- **THEN** the cookie is cleared and the old token no longer authenticates

#### Scenario: Logout is idempotent
- **WHEN** logout is called without a valid session
- **THEN** the response succeeds and the cookie is cleared

### Requirement: Session revocation

Incrementing a user's session version SHALL invalidate every existing session for that user,
independent of KV propagation. The helper SHALL be callable by admin revocation, password change,
and recovery flows.

#### Scenario: All sessions revoked
- **WHEN** the session version is incremented
- **THEN** every previously issued session for that user is rejected on its next request

### Requirement: Authentication audit events

Login success, login failure, and logout SHALL write payload-free audit events. Failed logins with
unknown emails SHALL use a null user reference. Events MAY include peppered UA and IP hashes but MUST
NOT include emails, passwords, auth hashes, tokens, or ciphertext.

#### Scenario: Successful and failed login
- **WHEN** login succeeds or fails
- **THEN** one corresponding audit event is written without request content

#### Scenario: Logout audited
- **WHEN** a user logs out
- **THEN** a logout event references that user
