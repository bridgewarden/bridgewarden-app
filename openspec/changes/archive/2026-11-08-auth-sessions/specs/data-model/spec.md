# Spec Delta

## ADDED Requirements

### Requirement: Session version storage

Each user row SHALL carry a non-negative session version that defaults to zero and only increases.
The value SHALL be stored in D1 as the authoritative revocation state for that user's sessions.

#### Scenario: New user default
- **WHEN** a user is created without an explicit session version
- **THEN** the stored session version is zero

#### Scenario: Version only increases
- **WHEN** a revocation increments the session version
- **THEN** the new value is greater than the previous value and cannot be negative
