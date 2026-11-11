# Spec Delta

## ADDED Requirements

### Requirement: Auto-lock settings

The account settings page SHALL expose an idle-timeout selector and a lock-on-tab-hide checkbox. Changes SHALL take effect without a reload and SHALL persist on the device.

#### Scenario: Change timeout
- **WHEN** the user selects a new timeout
- **THEN** the active timer adopts the new duration immediately

#### Scenario: Enable hide lock
- **WHEN** the user checks lock on tab hide
- **THEN** hiding the tab locks the vault

#### Scenario: Settings remain reachable
- **WHEN** the vault is unlocked and the user opens account settings
- **THEN** both controls are enabled and labelled

## MODIFIED Requirements

### Requirement: Locked shell overlay

When the vault is locked, the shell SHALL cover vault content with a locked overlay containing a password field, busy/error feedback, and a sign-out action. The overlay MUST be keyboard operable and MUST NOT render vault item content behind it.

#### Scenario: Lock action
- **WHEN** an authenticated unlocked user activates the lock action
- **THEN** the overlay appears, focus moves to the password field, and vault content is not exposed

#### Scenario: Idle lock
- **WHEN** the idle timeout fires on a protected route
- **THEN** protected children are removed and the locked overlay appears

#### Scenario: Unlock from overlay
- **WHEN** the correct master password is submitted
- **THEN** the overlay closes and the prior route remains usable without re-login

#### Scenario: Unlock after automatic lock
- **WHEN** the user enters the correct master password after an automatic lock
- **THEN** the prior route is usable without a server round trip

#### Scenario: Sign out from overlay
- **WHEN** the user chooses sign out while locked, or five local unlock attempts fail
- **THEN** the session is revoked, local data is wiped, and the login page appears

#### Scenario: Lock action availability
- **WHEN** an authenticated user views any protected route
- **THEN** the header lock action is enabled and keyboard reachable

#### Scenario: No session
- **WHEN** no session exists
- **THEN** the lock action remains disabled
