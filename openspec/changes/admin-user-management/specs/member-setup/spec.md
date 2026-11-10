# Spec Delta

## ADDED Requirements

### Requirement: Invitation acceptance validation

The member setup page SHALL accept only an unexpired, unconsumed invitation token whose hash matches a pending invitation. Invalid, expired, consumed, or malformed tokens MUST NOT reveal account details and MUST NOT create a user.

#### Scenario: Valid invitation opens setup
- **WHEN** a visitor opens `/setup/member?token=<valid>`
- **THEN** the page shows password and recovery-key steps for that invitation

#### Scenario: Invalid or expired token rejected
- **WHEN** the token is malformed, expired, consumed, or unknown
- **THEN** the page returns an invalid-invitation state and no user is created

#### Scenario: Raw token not logged
- **WHEN** an invitation is accepted
- **THEN** the raw token never appears in audit events, logs, or server responses after setup

### Requirement: Member key setup is client-only

The member SHALL set their own master password and recovery key in the browser. The server SHALL receive only derived transport material and MUST never receive the password, recovery secret, vault key, or recovery confirmation.

#### Scenario: Keys generated locally
- **WHEN** the member submits the setup form
- **THEN** the request contains only KDF parameters, auth hash, wrapped keys, and IVs

#### Scenario: Admin cannot see secrets
- **WHEN** the admin later views the user list
- **THEN** no password, recovery key, vault key, or auth hash is exposed

### Requirement: Atomic invitation consumption and user creation

Accepting an invitation SHALL consume the invitation and insert the member user with `status='active'` in one D1 transaction. A concurrent or repeated submission MUST create at most one user and consume the invitation once.

#### Scenario: First submission succeeds
- **WHEN** a valid invitation is submitted
- **THEN** the invitation is marked consumed and one active user row exists

#### Scenario: Repeated submission fails
- **WHEN** the same token is submitted again
- **THEN** the response is 409 or invalid and no second user is created

### Requirement: Member session handoff

After successful setup the member SHALL receive a normal session and be redirected to `/app`. The setup invitation MUST no longer be usable.

#### Scenario: Session issued after setup
- **WHEN** member setup completes
- **THEN** a session cookie is issued and the invitation cannot be reused

### Requirement: Member setup rate limit

`/setup/member` SHALL apply the existing per-IP auth rate limit. Over-budget requests MUST return 429 with `Retry-After` and MUST NOT consume the invitation or create a user.

#### Scenario: Rate-limited acceptance
- **WHEN** an IP exceeds the member-setup budget
- **THEN** the response is 429 and the invitation remains pending
