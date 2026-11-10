# app-shell Specification

## Purpose
Defines the persistent application frame that every page renders inside - header, action slots,
navigation, theme control, and responsive behavior - so navigation and account actions stay in
one predictable place across the product.

## Requirements

### Requirement: Persistent shell on every page

The system SHALL render every page inside a shared shell that provides a header with the product
mark, a main content landmark, and a constrained content container.

#### Scenario: Shell on a public route

- **WHEN** a visitor opens any page, including a page reachable without a session
- **THEN** the page renders with the shared header, a single main landmark, and the content container

#### Scenario: Shell on a protected route

- **WHEN** an authenticated user opens a protected page
- **THEN** the same header and main landmark are present and no second navigation landmark is introduced

### Requirement: Header action slots

The header SHALL expose a lock action slot and a user menu slot, and SHALL render them in a
visible disabled or placeholder state when no session exists.

#### Scenario: No session

- **WHEN** the shell renders for a visitor without a session
- **THEN** the lock action is not activatable and the user menu shows a sign-in entry point

#### Scenario: Active session

- **WHEN** the shell renders for a user with an active session
- **THEN** the lock action is present, keyboard reachable, and the user menu exposes account actions

### Requirement: Theme control

The shell SHALL provide a theme control offering light, dark, and system, and the selected
preference SHALL persist across reloads.

#### Scenario: Persisted preference

- **WHEN** a user selects dark and reloads the page
- **THEN** the page loads in dark mode with no flash of the light theme

#### Scenario: System preference

- **WHEN** a user selects system and the operating system switches to dark
- **THEN** the rendered theme follows the operating system without a reload

### Requirement: Responsive shell

The shell SHALL remain usable at viewport widths down to 360px, MUST NOT introduce horizontal
scrolling, and SHALL keep interactive targets at least 44px on touch viewports.

#### Scenario: Narrow viewport

- **WHEN** the page is rendered at 360px width
- **THEN** the header actions remain reachable and the document has no horizontal overflow

### Requirement: Shell renders without vault content

The shell SHALL render before unlock and MUST NOT contain vault item content, decrypted names, or
ciphertext in its own markup.

#### Scenario: Locked application

- **WHEN** the application is locked or the user has not unlocked the vault
- **THEN** the shell renders its header and navigation with no vault content in the document

### Requirement: Admin navigation

The shell SHALL expose a user-management navigation link only to authenticated administrators. Members and anonymous visitors MUST NOT see the link.

#### Scenario: Admin sees the link
- **WHEN** an administrator views the shell
- **THEN** a link to `/admin/users` is present and keyboard reachable

#### Scenario: Member does not see the link
- **WHEN** a member views the shell
- **THEN** no admin user-management link is rendered
