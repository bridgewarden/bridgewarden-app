# Spec Delta

## MODIFIED Requirements

### Requirement: Vault payload validation

Vault mutation bodies SHALL be validated at the boundary with strict schemas. Ciphertext MUST decode from canonical base64url and be at most 80KB, IVs MUST be 12 bytes, `dataVersion` MUST be at least 1, `type` MUST be `login` or `note`, and unknown fields MUST be rejected. Requests over 256KB MUST return 413; malformed or oversized encrypted fields MUST return 400 without logging payload contents.

#### Scenario: Oversized body
- **WHEN** a request body exceeds 256KB
- **THEN** the response is 413

#### Scenario: Maximum note ciphertext
- **WHEN** a 50KB note body produces ciphertext within the 80KB limit
- **THEN** the item is accepted and stored

#### Scenario: Malformed ciphertext
- **WHEN** a ciphertext field is not canonical base64url or exceeds 80KB
- **THEN** the response is 400

#### Scenario: Unknown field
- **WHEN** a body contains a field outside the schema
- **THEN** the response is 400

#### Scenario: No payload logging
- **WHEN** validation fails
- **THEN** logs contain no ciphertext, IV, token, or raw body content
