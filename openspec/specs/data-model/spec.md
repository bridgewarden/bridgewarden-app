# data-model Specification

## Purpose
Defines the durable storage contract for the password manager: user identity and wrapped keys,
ciphertext vault items and folders, 2FA persistence, audit events, dormant organization tables, and
the referential rules that keep them consistent.

## Requirements

### Requirement: User identity storage

The system SHALL store one user row per account with a lowercase email that is unique regardless of
case, a one-way authentication hash, KDF parameters and salt, and wrapped vault and recovery keys.
Role, status, vault revision, and lockout fields SHALL use constrained values.

#### Scenario: Duplicate email with different case

- **WHEN** an account is inserted with an email that differs from an existing one only by letter case
- **THEN** the insert is rejected by the unique email constraint

#### Scenario: No plaintext key material

- **WHEN** a user row is inspected
- **THEN** it contains no master password, vault key, or recovery key in plaintext

#### Scenario: New account defaults

- **WHEN** an account is created
- **THEN** the vault revision and failed-login count start at zero and role and status hold allowed values

### Requirement: Vault item storage

The system SHALL store each item as ciphertext plus IV with unencrypted metadata limited to
identifiers, type, favorite flag, folder, revision, timestamps, and tombstone. Item names,
usernames, passwords, URLs, notes, custom fields, and item TOTP seeds MUST NOT have plaintext
columns.

#### Scenario: Item content is ciphertext

- **WHEN** an item row is inspected
- **THEN** the name and all secret fields are absent and only ciphertext, IV, and metadata columns exist

#### Scenario: Revision and tombstone

- **WHEN** an item is updated or moved to trash
- **THEN** its revision increases and a tombstone timestamp distinguishes deleted rows

#### Scenario: Unknown item type

- **WHEN** an item is stored with a type other than login or note
- **THEN** the check constraint rejects it

### Requirement: Folder storage

Folders SHALL store encrypted names and metadata only, remain flat in the MVP, and carry a nullable tombstone timestamp. Deleting a folder MUST mark it deleted and detach its items rather than delete them. Folder rows and item rows MUST use the same revision watermark when deletion detaches items.

#### Scenario: Folder name is ciphertext

- **WHEN** a folder row is inspected
- **THEN** no plaintext folder name column exists

#### Scenario: Folder deletion detaches items

- **WHEN** a folder is deleted
- **THEN** its items remain, their folder reference becomes null, and their revision matches the folder tombstone revision

#### Scenario: Folder tombstone persists

- **WHEN** a folder is deleted
- **THEN** `deleted_at` is set and the row remains available for sync

### Requirement: Two-factor persistence

The system SHALL persist an encrypted TOTP seed, an enabled flag, and the last accepted time step
per user. Backup codes SHALL be stored only as hashes with a single-use marker.

#### Scenario: Replay state

- **WHEN** a TOTP code is accepted
- **THEN** the last accepted step is recorded so the same step cannot be accepted again

#### Scenario: Backup code is one-time

- **WHEN** a backup code is consumed
- **THEN** its used marker is set and the same hash cannot be consumed again

### Requirement: Audit event storage

The system SHALL record audit events with an optional user reference, event type, hashed network identifiers, optional caller-supplied metadata, and a timestamp. The stored row MUST preserve that metadata. Event metadata MUST NOT contain credentials, tokens, ciphertext, or vault content.

#### Scenario: User deletion keeps the event
- **WHEN** the referenced user is deleted
- **THEN** the audit event remains with a null user reference

#### Scenario: Caller metadata preserved
- **WHEN** an admin mutation supplies `{targetUserId}` or an invitation supplies `{invitationId}`
- **THEN** the stored audit row contains that JSON metadata

#### Scenario: No secrets in metadata
- **WHEN** any audit event is written
- **THEN** its metadata contains no email, password, token, TOTP code, or ciphertext

### Requirement: Dormant organization storage

Organization, membership, collection, and collection-item tables SHALL exist for phase 2 and MUST NOT
be referenced by any MVP route, loader, or action.

#### Scenario: Tables exist

- **WHEN** migrations are applied
- **THEN** the four organization tables exist with their role and membership constraints

#### Scenario: No MVP usage

- **WHEN** the MVP route tree is inspected
- **THEN** no route or server module reads or writes those tables

### Requirement: Referential integrity

Deleting a user SHALL remove their vault items, folders, 2FA row, and backup codes, and SHALL null
the user reference on audit events.

#### Scenario: User deletion cascades

- **WHEN** a user with items, a folder, 2FA, and backup codes is deleted
- **THEN** those rows are removed and their audit events remain with a null user reference

#### Scenario: Foreign keys are enforced

- **WHEN** a row references a user or folder that does not exist
- **THEN** the database rejects the write

### Requirement: Session version storage

Each user row SHALL carry a non-negative session version that defaults to zero and only increases.
The value SHALL be stored in D1 as the authoritative revocation state for that user's sessions.

#### Scenario: New user default
- **WHEN** a user is created without an explicit session version
- **THEN** the stored session version is zero

#### Scenario: Version only increases
- **WHEN** a revocation increments the session version
- **THEN** the new value is greater than the previous value and cannot be negative

### Requirement: Setup invitation storage

The system SHALL store pending member invitations with a lowercase unique email, display name, role, hashed token, inviter, expiry, optional consumption time, and creation time. The raw invitation token MUST NOT be stored.

#### Scenario: Token stored as hash
- **WHEN** an invitation is created
- **THEN** the table contains only the token hash and never the raw token

#### Scenario: Invitation is single-use
- **WHEN** an invitation is consumed
- **THEN** its consumption marker is set and the same token cannot be accepted again

#### Scenario: Email uniqueness with users
- **WHEN** a user already exists with the invitation email
- **THEN** the invitation cannot create a second account with that email

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
