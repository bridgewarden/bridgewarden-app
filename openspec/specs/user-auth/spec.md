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
- **THEN** the request proceeds to the second-factor challenge when enabled, otherwise to session issuance

#### Scenario: Unknown email
- **WHEN** an unknown email is submitted with any hash
- **THEN** the response is the generic 401

#### Scenario: Wrong password
- **WHEN** a known email is submitted with a non-matching `authHash`
- **THEN** the response is the generic 401

### Requirement: Login response and client unlock

A successful password login SHALL return KDF parameters and, when 2FA is disabled, the wrapped vault key and IV plus a session. With 2FA enabled it SHALL return only a challenge token and no session or key. The browser SHALL derive and unwrap only after the required factors succeed, clear the password, and navigate to the validated next path. The vault key MUST NOT be written to storage or a cookie.

#### Scenario: Unlocked landing page
- **WHEN** a user without 2FA logs in successfully
- **THEN** the response contains wrapped key material, a session cookie, and the app route unlocks

#### Scenario: Challenge before unlock with 2FA
- **WHEN** a user with 2FA logs in with a correct password
- **THEN** the response contains a challenge token and no session or wrapped key

#### Scenario: Unlock after challenge
- **WHEN** the second factor is verified successfully
- **THEN** the response contains wrapped key material and a session cookie

#### Scenario: Password cleared
- **WHEN** the client finishes deriving credentials or unwrapping
- **THEN** the password and derived key material are no longer held by the form

### Requirement: Session issuance and lifetime

Successful authentication SHALL issue a 32-byte random token stored only as its SHA-256 hash in KV,
set an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie valid for 30 days, and record
`{userId, createdAt, lastSeenAt, uaHash, ipHash, ver}`. The lifetime SHALL be absolute; activity
updates `lastSeenAt` but MUST NOT extend expiry.

#### Scenario: Cookie and KV shape
- **WHEN** a session is issued
- **THEN** the cookie carries the required attributes and KV stores only the token hash with metadata

#### Scenario: Activity does not extend lifetime
- **WHEN** a session is refreshed after the hourly threshold
- **THEN** only `lastSeenAt` changes and the absolute expiry stays fixed

#### Scenario: 2FA delays session issuance
- **WHEN** a user with 2FA submits only the password
- **THEN** no session is issued until the second factor succeeds

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

### Requirement: Rate-limited authentication requests

Authentication endpoints SHALL apply request budgets derived from HMAC hashes of the caller's IP and, when available, the account identifier. The IP budget applies before password verification. The account-identity budget SHALL be charged only for failed credential results, so repeated successful sign-ins cannot exhaust a victim's budget; an exhausted identity budget MUST return 429 with `Retry-After` and no session result. Raw IP addresses and emails MUST NOT be stored as rate-limit keys.

#### Scenario: Login rate limit rejects the request
- **WHEN** a caller exceeds the login budget for its IP hash or email hash
- **THEN** the response is 429 with `Retry-After`, and no password verification or session issuance occurs

#### Scenario: Two-factor rate limit rejects the request
- **WHEN** a caller exceeds the two-factor budget for its IP hash or challenge identity
- **THEN** the response is 429 with `Retry-After`, and the challenge is not consumed

#### Scenario: Limits are keyed by hashes
- **WHEN** a request is rate limited
- **THEN** no raw IP address or email is persisted in the rate-limit key

### Requirement: Account lockout after consecutive password failures

A known active account SHALL become locked after ten consecutive failed password attempts. The lock MUST last 15 minutes and a login attempt during the lock MUST return 423 with `Retry-After` without verifying or issuing a session. Unknown emails MUST continue to return the generic 401.

#### Scenario: Tenth failure locks the account
- **WHEN** the tenth consecutive password attempt fails for a known active account
- **THEN** the account's `locked_until` is set to 15 minutes from that attempt

#### Scenario: Locked account is rejected
- **WHEN** a login attempt targets an account whose `locked_until` is in the future
- **THEN** the response is 423 with `Retry-After` and no session is issued

#### Scenario: Unknown email remains generic
- **WHEN** an unknown email is submitted
- **THEN** the response remains the generic 401 and no lock state is created

### Requirement: Lockout reset and per-account isolation

A successful password login SHALL reset the account's consecutive failure count and lock deadline. A lock on one account MUST NOT lock another account, though the shared IP budget MAY still apply.

#### Scenario: Success resets counters
- **WHEN** a correct password is accepted before or after a lock expires
- **THEN** `failed_login_count` returns to zero and `locked_until` is cleared

#### Scenario: Another account remains usable
- **WHEN** one account is locked from an IP
- **THEN** a different account from the same IP can authenticate unless the shared IP budget is exhausted

### Requirement: Authenticated master-password rotation

An authenticated user SHALL change their master password by proving the current password and submitting only newly derived transport material. The server MUST verify the current auth hash, atomically replace the password hash, KDF parameters, and wrapped vault key, and leave vault items unchanged.

#### Scenario: Password rotation succeeds
- **WHEN** a user submits the correct current auth hash and valid new KDF/wrapped-key material
- **THEN** the stored password hash, KDF parameters, and vault-key wrapper are replaced in one update

#### Scenario: Old password stops working
- **WHEN** the password has been rotated
- **THEN** login with the old password returns the generic 401 and login with the new password succeeds

#### Scenario: Wrong current password
- **WHEN** the submitted current auth hash does not match the stored account
- **THEN** the request is rejected and no password or key material is changed

#### Scenario: Failed update leaves old password
- **WHEN** the database update fails
- **THEN** the account remains on the old password and old wrapped key

### Requirement: Password rotation reuses the vault key

Password rotation SHALL unwrap the existing vault key in the browser and re-wrap the same key under the new master key. The server MUST NOT receive the plaintext vault key, master password, or recovery secret. Recovery key material MUST remain valid after the password change.

#### Scenario: Ciphertext untouched
- **WHEN** a password rotation completes
- **THEN** vault item ciphertext and the vault key are unchanged, and only the wrapper changes

#### Scenario: No plaintext secret sent
- **WHEN** the browser submits a password rotation
- **THEN** the request contains only auth hashes, KDF parameters, wrapped keys, and IVs

#### Scenario: Recovery key still works
- **WHEN** the user later unwraps the vault with the existing recovery key
- **THEN** the unwrap succeeds

### Requirement: Rotation revokes other sessions

Password rotation SHALL invalidate every existing session except the current device. The current session MUST be reissued with the new session version.

#### Scenario: Other session rejected
- **WHEN** a second browser has an older session and the password is rotated elsewhere
- **THEN** the older session is rejected on its next request

#### Scenario: Current session remains usable
- **WHEN** rotation completes on the current device
- **THEN** a new cookie is issued and the device continues without re-login

### Requirement: Uniform recovery lookup

The recovery lookup SHALL accept an email and return only the account's recovery-wrapped vault key and IV. Known and unknown emails MUST receive the same status and field shape. Unknown emails SHALL receive deterministic synthetic wrapper and IV values derived from the configured pepper so repeated requests cannot reveal account existence. The response MUST NOT contain the master auth hash, KDF parameters, vault wrapper, tokens, or recovery proof.

#### Scenario: Known email lookup
- **WHEN** a client submits the email of an account with recovery material
- **THEN** the response contains that account's recovery wrapper and IV

#### Scenario: Unknown email lookup
- **WHEN** a client submits an email that does not exist
- **THEN** the response has the same status and shape with deterministic synthetic wrapper and IV values

#### Scenario: No credential material in lookup
- **WHEN** any recovery lookup response is inspected
- **THEN** it contains no master auth hash, KDF parameters, vault wrapper, session token, or recovery proof

### Requirement: Recovery proof verification

A recovery reset SHALL require a proof derived from the recovery secret with a domain separate from the vault wrap key. The server MUST verify the submitted proof against the stored recovery auth hash with `HMAC-SHA256(AUTH_PEPPER, proof || recoveryServerSalt)` and a constant-time comparison. Wrong proof, missing account, unknown email, and an account without recovery proof MUST return the same generic failure and MUST NOT mutate credentials.

#### Scenario: Correct recovery proof
- **WHEN** a reset request presents proof matching the stored recovery verifier
- **THEN** the reset may proceed

#### Scenario: Wrong recovery proof
- **WHEN** a reset request presents a non-matching proof
- **THEN** the response is a generic failure and the user row is unchanged

#### Scenario: Account without recovery proof
- **WHEN** a pre-migration account has no stored recovery verifier
- **THEN** the response is the same generic failure and no password material changes

### Requirement: Recovery reset rotates and burns credentials

A successful recovery reset SHALL replace the server auth hash, server salt, KDF parameters, vault-key wrapper, recovery-key wrapper, and recovery proof in one guarded update, increment the session version, and issue a new session for the resetting device. Every previous session MUST be rejected on its next request. The old recovery key MUST fail after the reset because both its wrapper and verifier are replaced.

#### Scenario: Successful reset
- **WHEN** the correct recovery proof and valid new password and recovery material are submitted
- **THEN** the account is updated atomically, a new session cookie is issued, and the vault key remains usable

#### Scenario: Old sessions revoked
- **WHEN** a reset completes while another browser holds a session
- **THEN** the other browser is rejected on its next request

#### Scenario: Old recovery key burned
- **WHEN** the account has been reset with a new recovery key
- **THEN** the old recovery key no longer unwraps the vault and no longer satisfies the recovery proof

#### Scenario: Session issuance fails after commit
- **WHEN** the credential update commits but the new session cannot be issued
- **THEN** the client still receives the new recovery key once and is directed to sign in with the new password

#### Scenario: Failed update leaves old credentials
- **WHEN** the guarded update changes no row because of a concurrent reset
- **THEN** the response is a generic failure and the previous credentials remain

### Requirement: Recovery audit

Recovery lookup failures, proof failures, and successful resets SHALL write payload-free audit events. Events MAY include peppered UA and IP hashes but MUST NOT include email, passwords, auth hashes, recovery secrets, proofs, tokens, or ciphertext.

#### Scenario: Failed reset audited
- **WHEN** a reset is rejected
- **THEN** an audit event is written without request secrets

#### Scenario: Successful reset audited
- **WHEN** a reset succeeds
- **THEN** a completion event references the user without any secret material

#### Scenario: Two-factor bypass audited
- **WHEN** a reset succeeds for an account with two-factor authentication enabled
- **THEN** the server records a distinct audit event marking the break-glass bypass
