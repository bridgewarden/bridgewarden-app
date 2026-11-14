# Spec Delta

## ADDED Requirements

### Requirement: Scheduled cleanup audit

Scheduled trash cleanup SHALL emit one redacted `vault.purge` audit event per affected user when it erases ciphertext. The event MUST identify the affected user as its subject and MUST NOT include item ids, folder ids, ciphertext, plaintext, or counts. Cleanup with no affected rows MUST NOT emit an event.

#### Scenario: Affected user is audited
- **WHEN** scheduled cleanup erases ciphertext belonging to a user
- **THEN** one `vault.purge` event is written for that user

#### Scenario: Empty cleanup is silent
- **WHEN** scheduled cleanup finds no expired ciphertext
- **THEN** no `vault.purge` event is written

#### Scenario: Purge audit has no content
- **WHEN** a scheduled `vault.purge` event is inspected
- **THEN** it contains no item id, folder id, ciphertext, plaintext, count, or request payload
