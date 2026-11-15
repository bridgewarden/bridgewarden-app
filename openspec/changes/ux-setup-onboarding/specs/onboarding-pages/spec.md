# Spec Delta

## Purpose

Defines the shared onboarding composition for first-run setup and invited-member onboarding: progress rail, step panel, focus behavior, safe back navigation, password strength, recovery-key actions, and invalid-invitation handling.

## ADDED Requirements

### Requirement: Shared onboarding frame

Setup and member onboarding SHALL render inside a shared frame with a step rail and a bordered panel. The frame MUST expose one page-level `h1`, mark exactly one current step with `aria-current="step"`, mark completed steps visually, and remain free of horizontal overflow at 320, 390, and 1440 pixels. The rail MUST NOT introduce a second page heading.

#### Scenario: Setup frame
- **WHEN** a visitor opens `/setup`
- **THEN** the page shows one `h1`, a four-step rail, and one bordered step panel

#### Scenario: Member frame
- **WHEN** a visitor opens a valid member setup link
- **THEN** the page shows one `h1`, a two-step Password/Recovery rail, and the invitation identity as a read-only summary

#### Scenario: Narrow viewport
- **WHEN** either onboarding frame renders at 320 pixels
- **THEN** the rail and panel stack without horizontal scrolling and every primary action remains at least 44 pixels tall

### Requirement: Step heading focus

The page `h1` SHALL receive focus when an onboarding page first loads. When the visible step changes, focus MUST move to that step's heading so keyboard and screen-reader users hear the new task.

#### Scenario: Initial load
- **WHEN** setup or member onboarding first renders
- **THEN** the page `h1` is focused

#### Scenario: Step changes
- **WHEN** the visitor advances or returns to another step
- **THEN** the new step heading is focused and announced

### Requirement: Setup step navigation

Setup SHALL present Account, Password, Recovery, and optional Two-Factor as ordered steps. Password SHALL provide a back action to Account. Recovery SHALL provide a back action to Password that clears generated key material and requires regeneration. Two-Factor MUST NOT provide a back action after the recovery key has been confirmed and discarded.

#### Scenario: Back from password
- **WHEN** the visitor activates back on the password step
- **THEN** the account step appears with the email and display name preserved

#### Scenario: Back from recovery
- **WHEN** the visitor activates back on the recovery step
- **THEN** the password step appears and previously generated key material is no longer usable

#### Scenario: Two-factor is terminal
- **WHEN** the visitor reaches the two-factor step
- **THEN** no back action is offered and the only progression is finishing setup

### Requirement: Informational two-factor step

The two-factor setup step SHALL explain that enrollment can happen later and SHALL allow completion without enrollment. It MUST NOT display a QR code, secret, or enrollment control that does not exist in the bootstrap contract, and completing or skipping it MUST NOT create a partial 2FA row.

#### Scenario: Skip two-factor
- **WHEN** the visitor finishes setup from the informational two-factor step
- **THEN** the account is created without a `user_2fa` row and the session handoff proceeds

#### Scenario: No fake enrollment
- **WHEN** the two-factor step renders
- **THEN** no QR code or TOTP secret is shown

### Requirement: Member password setup

Member onboarding SHALL collect the master password and confirmation on the Password step. It SHALL show the same password-strength feedback used by first-run setup, block a password shorter than the minimum, block mismatched confirmation, and keep the password in the browser only.

#### Scenario: Weak password
- **WHEN** the member enters a password shorter than the minimum
- **THEN** the Password step shows the length error and does not generate keys

#### Scenario: Mismatched confirmation
- **WHEN** the confirmation differs from the master password
- **THEN** the Password step shows the mismatch error and does not generate keys

#### Scenario: Strong password
- **WHEN** the member enters a valid password and matching confirmation
- **THEN** the strength indicator updates and the Recovery step appears

### Requirement: Recovery-key actions and confirmation

Setup and member recovery steps SHALL display the recovery key once, provide copy and download actions, state the offline-storage warning, and require the first six normalized characters before continuing. The recovery key and confirmation MUST NOT be sent to the server or written to browser storage.

#### Scenario: Copy or download
- **WHEN** the visitor copies or downloads the recovery key
- **THEN** the clipboard or file contains the formatted key and its offline-storage warning, and no network request is made

#### Scenario: Mismatched confirmation
- **WHEN** the typed-back characters do not match the displayed key
- **THEN** the step shows an inline error and does not submit

#### Scenario: Recovery back
- **WHEN** the member activates back from the Recovery step
- **THEN** the Password step appears and the previous generated material and vault key are cleared

### Requirement: Invalid invitation

An invalid, expired, consumed, or malformed member token SHALL show a generic invalid-invitation state without revealing account details. The state MUST provide an explicit route back to sign-in.

#### Scenario: Invalid token
- **WHEN** the member link is invalid or expired
- **THEN** the page shows the generic invalid message and a sign-in action

#### Scenario: No account disclosure
- **WHEN** an invalid token is opened
- **THEN** no email, display name, role, or invitation status is rendered
