# Spec Delta

## ADDED Requirements

### Requirement: Admin mutation rate limits

Admin invitation, role, disable, enable, and session-revoke mutations SHALL enforce both IP-scoped and actor-identity-scoped rate limits before any write. A rejected request MUST return `429` with `Retry-After` and MUST NOT change users, invitations, or sessions.

#### Scenario: Rejected mutation has no effect
- **WHEN** an admin mutation exceeds either limiter
- **THEN** the response is `429` and the target user, invitation, and session state are unchanged

#### Scenario: Mutation within budget succeeds
- **WHEN** an admin mutation is within both limits
- **THEN** the existing authorization and mutation behavior proceeds normally

### Requirement: Pending invitation revocation

An admin SHALL be able to revoke a pending setup invitation by id. Revocation MUST mark only an unconsumed invitation as consumed, return `404` for unknown or already consumed invitations, and emit `admin.invitation_revoked` with the actor and invitation id only. Revocation MUST NOT delete a user or change an existing account.

#### Scenario: Pending invitation is revoked
- **WHEN** an admin revokes a pending invitation
- **THEN** the setup link no longer creates a user and the invitation is no longer listed as pending

#### Scenario: Unknown invitation
- **WHEN** an admin revokes an unknown or already consumed invitation
- **THEN** the response is `404` and no user or invitation state changes

#### Scenario: Revocation is audited
- **WHEN** a pending invitation is revoked
- **THEN** an audit event records the actor and invitation id without email, token, or setup link

## MODIFIED Requirements

### Requirement: Admin mutation audit

Invitation creation, member setup completion, role changes, disable/enable, session revocation, and pending-invitation revocation SHALL emit audit events without emails, tokens, passwords, or key material.

#### Scenario: Mutation audited
- **WHEN** an admin changes another user, creates an invitation, or revokes a pending invitation
- **THEN** an audit event records the actor, target, and event type without secret payload
