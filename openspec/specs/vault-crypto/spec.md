# vault-crypto Specification

## Purpose
Defines the permanent client-side key hierarchy: master key derivation, server-verifiable auth
hash, wrapped vault key, versioned item envelope, recovery key, and the rules that keep key material
out of storage and logs.

## Requirements

### Requirement: Master key derivation

The system SHALL derive a 32-byte master key from the NFKC-normalized master password using
PBKDF2-SHA256 with a per-user salt and the iteration count stored for that user (default 600000).
The same password, salt, and count SHALL always produce the same key.

#### Scenario: Deterministic derivation

- **WHEN** the same password, salt, and iteration count are derived twice
- **THEN** both runs produce identical 32-byte keys

#### Scenario: Password normalization

- **WHEN** a password contains characters with different Unicode compositions
- **THEN** NFKC normalization makes the equivalent forms derive the same key

#### Scenario: No password retention

- **WHEN** derivation finishes
- **THEN** the module holds no reference to the plaintext password

### Requirement: Auth hash derivation

The system SHALL derive a 32-byte `authHash` from the master key with HKDF-SHA256 using info
`bw-auth` and no salt. The auth hash MUST NOT allow recovery of the master key.

#### Scenario: One-way derivation

- **WHEN** the auth hash is produced
- **THEN** no function in the module accepts it as input to reconstruct the master key

#### Scenario: Stable value

- **WHEN** the same master key is used on two devices
- **THEN** both derive the same auth hash for the same account

### Requirement: Vault key generation and wrapping

The system SHALL generate a 32-byte vault key from a CSPRNG once per account and wrap it with
AES-256-GCM under a wrap key derived from the master key with HKDF info `bw-wrap` and the account's
`kdfSalt`. Unwrapping SHALL happen only in memory.

#### Scenario: Wrap and unwrap

- **WHEN** the vault key is wrapped and then unwrapped with the correct master key and salt
- **THEN** the recovered bytes equal the original vault key

#### Scenario: Wrong password

- **WHEN** unwrap is attempted with a master key derived from the wrong password
- **THEN** it fails with an authentication error and returns no partial key

#### Scenario: Password change keeps ciphertext readable

- **WHEN** the master password changes and the same vault key is re-wrapped
- **THEN** previously sealed items still decrypt with the unwrapped vault key

### Requirement: Versioned item envelope

The system SHALL seal item payloads with AES-256-GCM using a fresh random 96-bit IV per encryption
and a versioned envelope `{ v: 1, alg: 'A256GCM', iv, ct }`. Unknown versions or algorithms SHALL be
rejected without a plaintext fallback.

#### Scenario: Round trip

- **WHEN** an item payload is sealed and opened with the vault key
- **THEN** the recovered object equals the original payload

#### Scenario: Tampering fails

- **WHEN** one byte of ciphertext or IV is changed
- **THEN** opening fails with an authentication error

#### Scenario: Unknown version

- **WHEN** an envelope declares a version the module does not support
- **THEN** it is rejected with an unsupported-format error and no plaintext is returned

#### Scenario: Fresh IV

- **WHEN** the same payload is sealed twice
- **THEN** the two envelopes carry different IVs

### Requirement: Recovery key

The system SHALL generate a 128-bit recovery secret, present it as 26 Crockford base32 characters,
and use HKDF-SHA256 with info `bw-recovery` and no salt to wrap the same vault key. Parsing SHALL
tolerate grouping separators and ambiguous characters. Regenerating the recovery key SHALL rewrap
the vault key and invalidate the previous display value.

#### Scenario: Recovery unwraps the vault

- **WHEN** the correct recovery key is used on the wrapped vault key
- **THEN** the recovered vault key equals the original

#### Scenario: Wrong recovery key

- **WHEN** an incorrect recovery key is used
- **THEN** unwrap fails with an authentication error and no partial key

#### Scenario: Regeneration invalidates the old key

- **WHEN** a new recovery key is generated
- **THEN** the old recovery key no longer unwraps the stored vault key

### Requirement: Key material stays in memory

The module SHALL NOT persist the master key, vault key, recovery secret, or unwrapped wrap keys to
local storage, session storage, IndexedDB, URLs, network payloads, or logs. It SHALL return key
material only to the caller in memory.

#### Scenario: No persisted key material

- **WHEN** any derivation or unwrap function returns
- **THEN** no storage API was written to and no log call received key bytes

#### Scenario: Errors carry no secrets

- **WHEN** any crypto function throws
- **THEN** the error message contains no password, key, salt, IV, or ciphertext value

### Requirement: Context-bound envelope v2

New vault envelopes SHALL use a versioned AES-256-GCM format whose additional authenticated data binds the ciphertext to its stable row context. The client SHALL continue to read v1 envelopes without weakening the new binding for v2.

#### Scenario: Relocated v2 ciphertext is rejected

- **WHEN** a valid v2 ciphertext is placed on a different row context
- **THEN** GCM verification fails and the client reports an integrity error instead of rendering the plaintext

#### Scenario: Existing v1 items remain readable

- **WHEN** a client opens an existing v1 envelope
- **THEN** the item decrypts through the documented legacy path and a new save upgrades it to v2
