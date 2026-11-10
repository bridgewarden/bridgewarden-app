# Spec Delta

## MODIFIED Requirements

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

A successful password login SHALL return `requires2fa`. It SHALL return KDF parameters only when 2FA
is disabled, together with the wrapped vault key and its IV, and SHALL issue the session. When 2FA is
enabled it SHALL return only a challenge token with no session and no wrapped key. The browser SHALL derive the
wrap key, unwrap the vault key only after both factors succeed, clear the master password, and
navigate to the validated `next` path or `/app`. The vault key MUST NOT be written to storage or a
cookie.

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
