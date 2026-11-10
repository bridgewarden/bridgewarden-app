# Spec Delta

## ADDED Requirements

### Requirement: Locked shell overlay

When the vault is locked, the shell SHALL cover vault content with a locked overlay containing a password field, busy/error feedback, and a sign-out action. The overlay MUST be keyboard operable and MUST NOT render vault item content behind it.

#### Scenario: Lock action
- **WHEN** an authenticated unlocked user activates the lock action
- **THEN** the overlay appears, focus moves to the password field, and vault content is not exposed

#### Scenario: Unlock from overlay
- **WHEN** the correct master password is submitted
- **THEN** the overlay closes and the prior route remains usable without re-login

#### Scenario: Sign out from overlay
- **WHEN** the user chooses sign out while locked, or five local unlock attempts fail
- **THEN** the session is revoked, local data is wiped, and the login page appears

#### Scenario: Lock action availability
- **WHEN** an authenticated user views any protected route
- **THEN** the header lock action is enabled and keyboard reachable

#### Scenario: No session
- **WHEN** no session exists
- **THEN** the lock action remains disabled
