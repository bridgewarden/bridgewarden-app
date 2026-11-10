# Spec Delta

## ADDED Requirements

### Requirement: Recovery proof at account creation

First-run setup and member setup SHALL derive a recovery proof from the generated recovery secret using the `bw-recovery-auth` domain and store only its server-verified hash with a random server salt. The recovery secret, vault key, and recovery wrap key MUST NOT be sent to the server.

#### Scenario: First admin setup stores recovery proof
- **WHEN** the first admin completes setup
- **THEN** the user row contains a recovery auth hash and recovery server salt alongside the recovery wrapper

#### Scenario: Member setup stores recovery proof
- **WHEN** an invited member completes setup
- **THEN** the created user row contains a recovery auth hash and recovery server salt

#### Scenario: No recovery secret transmitted
- **WHEN** a setup request is inspected
- **THEN** it contains only derived auth values, KDF parameters, wrapped keys, and IVs

### Requirement: Recovery proof replacement

A successful recovery reset SHALL persist the new recovery auth hash and server salt produced from the regenerated recovery secret, replacing the previous values. The previous proof MUST no longer verify.

#### Scenario: Reset replaces proof
- **WHEN** a recovery reset completes
- **THEN** the stored recovery auth hash and server salt differ from the previous values

#### Scenario: Previous proof rejected
- **WHEN** the pre-reset recovery proof is submitted after a successful reset
- **THEN** verification fails with the generic error
