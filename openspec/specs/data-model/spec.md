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

Folders SHALL store encrypted names and metadata only, remain flat in the MVP, and deleting a folder
MUST detach its items rather than delete them.

#### Scenario: Folder name is ciphertext

- **WHEN** a folder row is inspected
- **THEN** no plaintext folder name column exists

#### Scenario: Folder deletion detaches items

- **WHEN** a folder is deleted
- **THEN** its items remain and their folder reference becomes null

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

The system SHALL record audit events with an optional user reference, event type, hashed network
identifiers, optional metadata, and a timestamp. Event metadata MUST NOT contain credentials, tokens,
ciphertext, or vault content.

#### Scenario: User deletion keeps the event

- **WHEN** the referenced user is deleted
- **THEN** the audit event remains with a null user reference

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
