# Spec Delta

## ADDED Requirements

### Requirement: Recovery verifier storage

Each user row SHALL support a recovery auth hash and recovery server salt. Both SHALL be nullable for accounts created before the recovery reset capability exists. When present, they SHALL store only the server-verified HMAC output and random salt, never the recovery secret, proof, vault key, or recovery wrap key.

#### Scenario: New account has recovery verifier
- **WHEN** a user is created through setup or member setup after this change
- **THEN** `recovery_auth_hash` and `recovery_server_salt` are non-null

#### Scenario: Legacy account remains null
- **WHEN** an existing user row is migrated without regenerating its recovery key
- **THEN** both recovery verifier columns remain null

#### Scenario: No plaintext recovery material
- **WHEN** a user row is inspected
- **THEN** it contains no recovery secret, recovery auth proof, vault key, or recovery wrap key in plaintext

### Requirement: Atomic credential replacement

The database SHALL allow a recovery reset to replace the master auth hash, server salt, KDF parameters, vault wrapper, recovery wrapper, and recovery verifier in one guarded statement that is conditional on the verified recovery proof and active status. A concurrent reset that no longer matches the precondition MUST change no rows.

#### Scenario: Conditional reset succeeds once
- **WHEN** a reset matches the active row and current recovery verifier
- **THEN** exactly one user row is updated and the session version increments once

#### Scenario: Concurrent reset fails closed
- **WHEN** a second reset uses the pre-reset recovery verifier
- **THEN** it changes no rows and leaves the first reset intact
