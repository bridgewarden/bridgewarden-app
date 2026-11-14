# admin-users Specification

## Purpose
Defines admin-only account management: listing users, creating invitations, changing roles, enabling or disabling accounts, and revoking sessions while protecting the last active administrator.

## Requirements

### Requirement: Admin-only user management access

The user management page and its mutations SHALL require an authenticated session with `role = 'admin'`. Non-admin page requests SHALL receive 403; non-admin API requests MUST NOT mutate another account.

#### Scenario: Member is rejected
- **WHEN** a member requests `/admin/users` or an admin mutation
- **THEN** the response is 403 and no user or session state changes

#### Scenario: Anonymous visitor is rejected
- **WHEN** a visitor without a session requests an admin route
- **THEN** the page redirects to login and an API mutation returns 401

### Requirement: Admin user listing

The admin page SHALL list user id, email, display name, role, status, 2FA state, created time, and pending invitation state. The response MUST NOT include authentication hashes, wrapped keys, TOTP seeds, recovery material, or session tokens.

#### Scenario: Secrets excluded
- **WHEN** the admin page loader returns users
- **THEN** every row contains only identity, role, status, 2FA boolean, timestamps, and pending-setup metadata

#### Scenario: Pending invitation visible
- **WHEN** an invitation exists but has not been consumed
- **THEN** the admin list shows it as pending setup rather than as an active account

### Requirement: One-time setup invitations

Creating a user SHALL create a pending invitation with email, display name, role, hashed token, inviter, and a 24-hour expiry. The raw token SHALL be returned once in the setup link and MUST NOT be stored or logged. The admin MUST provide the link manually; no email is sent.

#### Scenario: Invitation link returned once
- **WHEN** an admin creates a valid invitation
- **THEN** the response contains the setup link and the database stores only the token hash

#### Scenario: Duplicate pending invitation
- **WHEN** an admin creates an invitation for an email with a pending invitation
- **THEN** the old invitation is replaced or rejected without creating a duplicate user

#### Scenario: Existing user conflict
- **WHEN** an admin creates an invitation for an email that already has a user
- **THEN** the response is 409 and no invitation is created

### Requirement: Disable, enable, and revoke sessions

Disabling a user SHALL set status to disabled and increment the session version so existing sessions are rejected. Enabling SHALL restore login capability without restoring old sessions. Revoking sessions SHALL increment the session version without changing status.

#### Scenario: Disable revokes access
- **WHEN** an admin disables an active user
- **THEN** the user cannot authenticate and every existing session is rejected

#### Scenario: Enable keeps sessions revoked
- **WHEN** an admin enables a disabled user
- **THEN** the user can authenticate again with a new session and old sessions remain invalid

#### Scenario: Revoke only sessions
- **WHEN** an admin revokes a user's sessions
- **THEN** the user remains active but all existing sessions are rejected

### Requirement: Last active admin protection

The system SHALL reject disabling or demoting the last active administrator. The guard MUST be enforced atomically with the write.

#### Scenario: Last admin cannot be disabled
- **WHEN** an admin attempts to disable the only active administrator
- **THEN** the response is 409 and the user remains active

#### Scenario: Last admin cannot be demoted
- **WHEN** an admin attempts to change the only active administrator to member
- **THEN** the response is 409 and the role remains admin

### Requirement: Admin mutation audit

Invitation creation, member setup completion, role changes, disable/enable, session revocation, and pending-invitation revocation SHALL emit audit events without emails, tokens, passwords, or key material.

#### Scenario: Mutation audited
- **WHEN** an admin changes another user, creates an invitation, or revokes a pending invitation
- **THEN** an audit event records the actor, target, and event type without secret payload

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
