# Spec Delta

## ADDED Requirements

### Requirement: Context-bound envelope v2

New vault envelopes SHALL use a versioned AES-256-GCM format whose additional authenticated data binds the ciphertext to its stable row context. The client SHALL continue to read v1 envelopes without weakening the new binding for v2.

#### Scenario: Relocated v2 ciphertext is rejected

- **WHEN** a valid v2 ciphertext is placed on a different row context
- **THEN** GCM verification fails and the client reports an integrity error instead of rendering the plaintext

#### Scenario: Existing v1 items remain readable

- **WHEN** a client opens an existing v1 envelope
- **THEN** the item decrypts through the documented legacy path and a new save upgrades it to v2
