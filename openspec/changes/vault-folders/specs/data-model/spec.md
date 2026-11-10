# Spec Delta

## MODIFIED Requirements

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
