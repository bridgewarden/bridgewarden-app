# Spec Delta

## ADDED Requirements

### Requirement: Pending enrollment expiration

A pending 2FA enrollment SHALL expire ten minutes after it was last started. Verification SHALL reject an expired pending enrollment, delete or ignore it, and return the not-pending response without enabling the factor. Starting enrollment again SHALL refresh the window.

#### Scenario: Enrollment within the window enables
- **WHEN** a user submits a valid code for a pending enrollment started less than ten minutes ago
- **THEN** the factor becomes enabled and the existing backup-code flow runs

#### Scenario: Expired enrollment is rejected
- **WHEN** a user submits a code for a pending enrollment older than ten minutes
- **THEN** the factor remains disabled and the response is not-pending

#### Scenario: Restart refreshes the window
- **WHEN** the user starts enrollment again before the previous pending secret expires
- **THEN** the new pending secret replaces the old one and receives a fresh ten-minute window

#### Scenario: Expired response exposes no seed
- **WHEN** an expired pending enrollment is rejected
- **THEN** the response contains no TOTP secret, URI, or backup code
