# Spec Delta

## ADDED Requirements

### Requirement: Vault-key copy zeroization

Key existence checks SHALL NOT return an unzeroed key copy. Every consumer that needs key bytes SHALL take an owned copy and wipe it, and replacing the active key SHALL wipe the previous buffer.

#### Scenario: Existence check
- **WHEN** sync or outbox checks whether a vault key exists
- **THEN** no key buffer is allocated or the allocated buffer is not exposed

#### Scenario: Key replacement
- **WHEN** unlock or setup replaces the active key
- **THEN** the previous buffer is zeroed before reassignment

### Requirement: Outbox ciphertext validation at every boundary

The outbox SHALL validate a strict ciphertext schema for payloads, optimistic/previous rows, and persisted entries at enqueue and immediately before transport. A plaintext-shaped or unknown field MUST fail closed.

#### Scenario: Flush-time tamper
- **WHEN** a persisted outbox entry contains a plaintext field
- **THEN** the flush fails without sending it and records an error

#### Scenario: Optimistic row
- **WHEN** a create includes an optimistic ciphertext row
- **THEN** that row is validated before it is written to IndexedDB

### Requirement: Logout wipes local state on failure

Sign-out SHALL clear the in-memory key and wipe local vault state even when the server logout request fails. The UI MAY report the server error but MUST NOT leave decrypted-capable local state resident.

#### Scenario: Server logout fails
- **WHEN** the logout action returns an error or the request fails
- **THEN** the vault key is cleared and IndexedDB is wiped
