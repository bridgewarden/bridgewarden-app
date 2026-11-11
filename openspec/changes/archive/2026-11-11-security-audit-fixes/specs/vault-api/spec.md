# Spec Delta

## ADDED Requirements

### Requirement: Purged tombstones cannot be restored

An item whose ciphertext was erased by purge MUST NOT be restorable. Restore SHALL require a soft-deleted row with non-empty ciphertext.

#### Scenario: Restore purged item
- **WHEN** the owner restores an item whose ciphertext and IV are empty
- **THEN** the request is rejected as not found or conflict and the row stays purged
