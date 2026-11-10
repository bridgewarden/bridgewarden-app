# Spec Delta

## Purpose

Defines an optional TOTP second factor: seed protection, enrollment, login challenges with replay
protection, and single-use backup codes, so a master password alone cannot issue a session.

## ADDED Requirements

### Requirement: TOTP authentication primitives

The server SHALL implement RFC 6238 TOTP with HMAC-SHA1, six digits, and 30-second steps from a
160-bit secret. Verification SHALL accept the current step and one step either side and reject any
step less than or equal to the stored `last_totp_step`.

#### Scenario: Current code is accepted
- **WHEN** a valid code for the current step is submitted
- **THEN** verification succeeds and reports the accepted step

#### Scenario: Adjacent step is accepted
- **WHEN** a valid code for the previous or next step is submitted within the window
- **THEN** verification succeeds

#### Scenario: Replayed step is rejected
- **WHEN** a code with a step equal to or below the stored last accepted step is submitted
- **THEN** verification fails

### Requirement: Seed protection at rest

The TOTP seed SHALL be encrypted before storage with AES-256-GCM under a key derived from
`TOTP_ENC_KEY`, using a fresh IV and a user-bound associated value. The seed MUST be decrypted only
inside verification and MUST NOT appear in any response after enrollment, log, or client storage.

#### Scenario: Stored seed is ciphertext
- **WHEN** a `user_2fa` row is inspected
- **THEN** only ciphertext and IV columns are present, with no plaintext seed

#### Scenario: Seed is not returned after enrollment
- **WHEN** enrollment or verification responses after the initial display are inspected
- **THEN** they contain no TOTP seed

### Requirement: Two-factor enrollment

An authenticated user SHALL be able to begin enrollment. The enrollment response SHALL include the
otpauth URI and secret once; the QR code SHALL be rendered locally from that URI. The factor SHALL
become enabled only after a valid six-digit code is verified. A failed code MUST leave it disabled.

#### Scenario: Enrollment starts disabled
- **WHEN** a user starts enrollment
- **THEN** a pending encrypted seed is stored with `enabled = 0` and a secret/URI is returned once

#### Scenario: Valid code enables the factor
- **WHEN** the user submits a valid code for the pending seed
- **THEN** `enabled` becomes 1 and ten backup codes are returned once

#### Scenario: Invalid enrollment code
- **WHEN** the submitted code is invalid
- **THEN** the response fails and the factor remains disabled

#### Scenario: Enrollment requires a session
- **WHEN** an unauthenticated request calls an enrollment endpoint
- **THEN** the response is 401

### Requirement: Login challenge when 2FA is enabled

When 2FA is enabled, password verification SHALL create a five-minute challenge token stored in KV by
token hash with the user and attempt count. The response SHALL contain `requires2fa: true` and the
challenge token, with no session cookie and no wrapped vault key.

#### Scenario: Challenge replaces session
- **WHEN** a user with 2FA enabled submits correct credentials
- **THEN** the response requires 2FA, sets no session cookie, and returns no wrapped key material

#### Scenario: Challenge expires
- **WHEN** a challenge token older than five minutes is submitted
- **THEN** verification fails and no session is issued

#### Scenario: Disabled factor skips challenge
- **WHEN** a user without enabled 2FA submits correct credentials
- **THEN** the login response issues the session and wrapped key directly

### Requirement: Challenge verification and attempt limit

The challenge endpoint SHALL accept a TOTP code or a backup code. On success it SHALL update the
accepted TOTP step conditionally, issue the session cookie, and return the wrapped key material. Five
failed attempts SHALL invalidate the challenge and require a new password login.

#### Scenario: Valid TOTP completes login
- **WHEN** a valid TOTP code is submitted with a live challenge
- **THEN** the session and wrapped key material are returned

#### Scenario: Valid backup code completes login
- **WHEN** an unused backup code is submitted with a live challenge
- **THEN** the session is issued and the code is consumed

#### Scenario: Five failures invalidate the challenge
- **WHEN** the fifth invalid code is submitted for a challenge
- **THEN** the challenge is deleted and no further attempt can succeed with that token

### Requirement: Backup code lifecycle

The system SHALL generate ten backup codes in an unambiguous alphabet, store only
HMAC-SHA256(`AUTH_PEPPER`, normalized code) hashes with a usage marker, and display the plaintext
codes once. A code SHALL be consumable exactly once through a conditional update. Regeneration SHALL
replace all existing codes.

#### Scenario: Code is single use
- **WHEN** a backup code is accepted
- **THEN** its usage marker is set and the same code is rejected afterwards

#### Scenario: Regeneration invalidates old codes
- **WHEN** the user regenerates backup codes
- **THEN** all previous hashes are removed and only the new ten codes work

#### Scenario: Only hashes are stored
- **WHEN** a backup-code row is inspected
- **THEN** it contains a hash and usage marker, never the plaintext code

### Requirement: Disabling two-factor authentication

An authenticated user SHALL be able to disable 2FA only after re-verifying the master password. On
success the factor SHALL be disabled and its seed and backup codes removed.

#### Scenario: Correct password disables the factor
- **WHEN** a logged-in user submits a matching auth hash after re-entering the password
- **THEN** 2FA becomes disabled and stored seeds and backup codes are removed

#### Scenario: Wrong password leaves 2FA enabled
- **WHEN** the submitted auth hash does not match
- **THEN** the request fails and 2FA remains enabled

### Requirement: Two-factor audit events

Enrollment, successful verification, failures, backup-code use, disable, and regeneration SHALL write
payload-free audit events. Events MUST NOT include TOTP seeds, TOTP codes, backup codes, challenge
tokens, or hashes.

#### Scenario: Verification success and failure are audited
- **WHEN** a challenge attempt succeeds or fails
- **THEN** a corresponding audit event is written without credentials or codes

#### Scenario: Enrollment and disable are audited
- **WHEN** a user enables or disables 2FA
- **THEN** an audit event references that user
