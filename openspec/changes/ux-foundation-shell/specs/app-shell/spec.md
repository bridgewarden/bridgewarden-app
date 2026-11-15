# Spec Delta

## MODIFIED Requirements

### Requirement: Header action slots

The header SHALL render a public variant when no session exists and an authenticated variant when a session exists. The public variant MUST show the product mark and theme control only, without a disabled lock action or account placeholder. The authenticated variant SHALL expose navigation, the lock action, and the account menu.

#### Scenario: No session
- **WHEN** the shell renders for a visitor without a session
- **THEN** the header shows the product mark and theme control, and no lock or account menu is rendered

#### Scenario: Active session
- **WHEN** the shell renders for a user with an active session
- **THEN** navigation, the lock action, and the account menu are present and keyboard reachable

#### Scenario: Auth page does not expose account controls
- **WHEN** a visitor opens login, setup, member setup, or recovery
- **THEN** the header does not show a disabled lock button or a sign-in placeholder

### Requirement: Locked shell overlay

When the vault is locked, the shell SHALL cover vault content with a focus-managed locked overlay containing a password field, busy/error feedback, and a sign-out action. Focus MUST enter the overlay, remain trapped while it is open, and return to a safe control after unlock. Escape MUST NOT dismiss the overlay. Vault item content MUST NOT be rendered behind it.

#### Scenario: Lock action
- **WHEN** an authenticated unlocked user activates the lock action
- **THEN** the overlay appears, focus moves into the password field, and protected vault content is removed

#### Scenario: Focus remains trapped
- **WHEN** the user presses Tab or Shift+Tab inside the overlay
- **THEN** focus cycles within the overlay and does not reach the page behind it

#### Scenario: Escape does not unlock
- **WHEN** the user presses Escape while the overlay is open
- **THEN** the overlay remains open and the vault stays locked

#### Scenario: Idle lock
- **WHEN** the idle timeout fires on a protected route
- **THEN** protected children are removed and the locked overlay appears

#### Scenario: Unlock from overlay
- **WHEN** the correct master password is submitted
- **THEN** the overlay closes, focus returns to a safe control, and the prior route remains usable without re-login

#### Scenario: Unlock after automatic lock
- **WHEN** the user enters the correct master password after an automatic lock
- **THEN** the prior route is usable without a server round trip

#### Scenario: Sign out from overlay
- **WHEN** the user chooses sign out while locked, or five local unlock attempts fail
- **THEN** the session is revoked, local data is wiped, and the login page appears

#### Scenario: Lockout message is visible
- **WHEN** the fifth local unlock attempt fails
- **THEN** the lockout message is rendered before the sign-out navigation occurs

#### Scenario: Lock action availability
- **WHEN** an authenticated user views any protected route
- **THEN** the header lock action is enabled and keyboard reachable

#### Scenario: No session
- **WHEN** no session exists
- **THEN** the public header does not render a lock action

## ADDED Requirements

### Requirement: Active navigation and mobile identity

The authenticated header SHALL mark the current destination with `aria-current="page"` and SHALL expose the signed-in account identity in the mobile menu.

#### Scenario: Current destination
- **WHEN** the user is on a vault, trash, settings, or admin destination
- **THEN** the matching header link is marked current and no other destination is marked current

#### Scenario: Mobile identity
- **WHEN** the authenticated header collapses into the mobile menu
- **THEN** the menu shows the signed-in display name or email
