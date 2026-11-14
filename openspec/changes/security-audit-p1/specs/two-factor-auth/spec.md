# Spec Delta

## ADDED Requirements

### Requirement: Cumulative second-factor failure budget

TOTP and backup-code verification SHALL charge failures to a per-account budget that survives challenge rotation. The budget SHALL lock second-factor verification after the configured threshold for a cooling-off period, while leaving password login independent.

#### Scenario: Rotating challenges does not reset the factor budget

- **WHEN** a caller exhausts one challenge's five attempts and obtains a new challenge with a correct password
- **THEN** the cumulative factor failure count remains and the next wrong code advances it

#### Scenario: Factor lockout cools off

- **WHEN** the cumulative factor failures reach the threshold and the cooling-off period expires
- **THEN** a correct factor proof is accepted and the cumulative counter is reset

#### Scenario: Factor lockout does not lock password login

- **WHEN** the factor budget is locked
- **THEN** password authentication remains available subject only to the login lockout
