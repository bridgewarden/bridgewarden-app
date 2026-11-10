# Spec Delta

## ADDED Requirements

### Requirement: Setup invitation storage

The system SHALL store pending member invitations with a lowercase unique email, display name, role, hashed token, inviter, expiry, optional consumption time, and creation time. The raw invitation token MUST NOT be stored.

#### Scenario: Token stored as hash
- **WHEN** an invitation is created
- **THEN** the table contains only the token hash and never the raw token

#### Scenario: Invitation is single-use
- **WHEN** an invitation is consumed
- **THEN** its consumption marker is set and the same token cannot be accepted again

#### Scenario: Email uniqueness with users
- **WHEN** a user already exists with the invitation email
- **THEN** the invitation cannot create a second account with that email
