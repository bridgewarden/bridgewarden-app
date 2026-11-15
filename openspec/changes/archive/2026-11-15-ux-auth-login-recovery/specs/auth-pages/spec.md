# Spec Delta

## Purpose

Defines the public authentication entry surfaces: the composed login and recovery frame, sign-in guidance, two-factor challenge behavior, recovery step navigation, validation, and recovery-key handoff.

## ADDED Requirements

### Requirement: Composed public auth frame

Public login and recovery pages SHALL render inside a composed frame with a guidance area and a bordered form panel. The frame MUST expose one page-level `h1`, MUST NOT repeat the product brand already present in the public header, and MUST remain free of horizontal overflow at 320, 390, and 1440 pixels.

#### Scenario: Login frame
- **WHEN** a visitor opens the login page
- **THEN** the page shows one `h1`, a guidance area, and one bordered form panel

#### Scenario: Recovery frame
- **WHEN** a visitor opens the recovery page
- **THEN** the page uses the same frame geometry as login without repeating the public-header brand

#### Scenario: Narrow viewport
- **WHEN** the frame renders at 320 pixels wide
- **THEN** content stacks without horizontal scrolling and the primary action remains at least 44 pixels tall

### Requirement: Login guidance and recovery entry

The login page SHALL provide short, factual guidance about local unlock and SHALL expose a visible link to the recovery flow. Security statements MUST describe behavior that exists by default and MUST NOT claim that the vault locks when the tab is hidden, that client memory is zero-knowledge, or that recovery works without the recovery key.

#### Scenario: Recovery entry
- **WHEN** a visitor views the login form
- **THEN** a link named "Use a recovery key" navigates to the recovery page

#### Scenario: Verified guidance
- **WHEN** the login guidance mentions key handling or recovery
- **THEN** every statement describes default behavior and names the recovery key as required

### Requirement: Login validation and focus

The login page SHALL focus the email field on initial render. Email and password validation SHALL be reported separately, each error MUST be associated with its field, and form-level authentication or rate-limit failures SHALL use a live alert without exposing raw server text. The primary submit action SHALL span the form width.

#### Scenario: Initial focus
- **WHEN** the login page finishes rendering
- **THEN** the email field has focus

#### Scenario: Missing email
- **WHEN** the visitor submits without an email
- **THEN** the email field is invalid, references its own error, and receives focus

#### Scenario: Missing password
- **WHEN** the visitor submits without a master password
- **THEN** the password field is invalid, references its own error, and receives focus

#### Scenario: Server rejection
- **WHEN** the credentials are rejected or rate limited
- **THEN** one form-level live alert shows catalog copy and neither field renders a raw server response

#### Scenario: Primary action
- **WHEN** the login form renders at any supported width
- **THEN** the submit action spans the form and remains at least 44 pixels tall

### Requirement: Two-factor challenge focus and busy state

The two-factor challenge SHALL focus the code input when it appears, SHALL disable the code input while a verification request is active, and SHALL keep verification as the only primary action. Switching between authenticator and backup-code modes and returning to credentials SHALL remain secondary actions.

#### Scenario: Challenge appears
- **WHEN** the server requires a second factor
- **THEN** focus moves to the code input and the verification action is primary

#### Scenario: Verification in flight
- **WHEN** the visitor submits a code
- **THEN** the code input and secondary actions are disabled until the request settles

#### Scenario: Mode switch
- **WHEN** the visitor switches to a backup code or back to credentials
- **THEN** the primary verification action remains visually primary and the other actions remain secondary

### Requirement: Recovery step navigation

The recovery page SHALL present email lookup and reset as distinct steps. The reset step MUST offer a back action that returns to the email step without discarding the entered email, and each step change MUST move focus to that step's heading.

#### Scenario: Enter reset step
- **WHEN** the recovery lookup succeeds
- **THEN** the reset step appears and its heading receives focus

#### Scenario: Return to email
- **WHEN** the visitor activates back from the reset step
- **THEN** the email step appears with the previous email preserved and its heading focused

### Requirement: Recovery validation and strength feedback

Recovery SHALL report recovery-key, password-length, and confirmation errors separately and associate each error with its field. It SHALL show password strength and a mismatch message before the reset request. Authentication failures, rate limits, and server failures SHALL use catalog-backed live alerts and MUST NOT reveal whether the account or key was the failing part.

#### Scenario: Short password
- **WHEN** the new password is shorter than the minimum
- **THEN** the password field is invalid and references the length error

#### Scenario: Password mismatch
- **WHEN** the confirmation differs from the new password
- **THEN** the confirmation field is invalid and references the mismatch error

#### Scenario: Weak password feedback
- **WHEN** the visitor types a new password
- **THEN** the strength indicator and its accessible value update before submission

#### Scenario: Invalid key
- **WHEN** the server rejects the recovery key
- **THEN** one generic live alert appears and no copy reveals whether the email or key failed

### Requirement: Recovery-key handoff

After a successful reset, recovery SHALL show the new key once in a bordered result panel with copy and download actions. The downloaded file MUST contain the key and the offline-storage warning. The page MUST also provide an explicit return to sign-in in addition to any continue action.

#### Scenario: Reset succeeds
- **WHEN** the reset completes
- **THEN** the new recovery key and its one-time warning are visible in the result panel

#### Scenario: Download key
- **WHEN** the visitor downloads the key
- **THEN** the file contains the recovery key and the offline-storage warning

#### Scenario: Return to sign-in
- **WHEN** the success panel is visible
- **THEN** an explicit sign-in action is available even when a session was issued
