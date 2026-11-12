# credential-tools Specification

## Purpose
Defines the credential utility behaviors that support vault items: secure password and passphrase generation, client-side TOTP codes for stored secrets, and clipboard/reveal safety.

## Requirements

### Requirement: Password policy generation

The generator SHALL produce passwords from 8-64 characters using at least one enabled set of uppercase, lowercase, digits, and symbols. It MUST use a cryptographically secure random source, guarantee at least one character from every enabled set, exclude ambiguous characters only when requested, and reject a configuration with no enabled set.

#### Scenario: Valid password policy
- **WHEN** the user enables uppercase, lowercase, digits, and symbols at length 24
- **THEN** the generated value is 24 characters and contains at least one character from each enabled set

#### Scenario: No character set
- **WHEN** every character set is disabled
- **THEN** generation is rejected and no value is displayed

#### Scenario: Length bounds
- **WHEN** the requested length is below 8 or above 64
- **THEN** generation is rejected with a policy error

#### Scenario: Exclude ambiguous
- **WHEN** exclude-ambiguous is enabled
- **THEN** the generated value contains none of the configured ambiguous characters

### Requirement: Passphrase generation

Passphrase mode SHALL generate 3-6 words from a bundled word list using a cryptographically secure random source, with a selected separator and optional capitalization. It MUST validate the word count and return entropy metadata for the strength display.

#### Scenario: Valid passphrase
- **WHEN** the user requests six words with a hyphen separator
- **THEN** the value contains six selected words separated by hyphens

#### Scenario: Invalid word count
- **WHEN** the requested word count is below 3 or above 6
- **THEN** generation is rejected with a policy error

#### Scenario: Capitalization
- **WHEN** capitalization is enabled
- **THEN** each selected word follows the selected capitalization policy

### Requirement: Generator strength display

The generator SHALL display strength derived from estimated entropy: weak below 40 bits, fair below 60 bits, strong below 80 bits, and very strong at 80 bits or above. The estimate MUST reflect the selected character policy or passphrase word count.

#### Scenario: Weak password
- **WHEN** a short password with a small enabled alphabet is generated
- **THEN** the strength display reports weak

#### Scenario: Strong passphrase
- **WHEN** a six-word passphrase from the bundled word list is generated
- **THEN** the strength display reports strong

### Requirement: Generator access and application

The client SHALL expose the generator as a protected standalone page and as an embeddable panel reachable from the login password field. Applying a generated value SHALL update the password field without submitting the item form, and copying it SHALL use the shared clipboard lifecycle.

#### Scenario: Standalone generator
- **WHEN** an authenticated user opens the generator page
- **THEN** the generator controls and a generated value are available

#### Scenario: Apply from editor
- **WHEN** the user applies a generated value from the editor panel
- **THEN** the password field is updated and the item is not submitted

#### Scenario: Copy from generator
- **WHEN** the user copies a generated value
- **THEN** the confirmation toast is shown and the clipboard timer starts

### Requirement: Generator preference persistence

Generator options SHALL persist in a non-sensitive local preference store and MUST NOT contain generated values, vault plaintext, wrapped keys, or passwords. Missing, invalid, or unavailable storage SHALL fall back to safe defaults, and sign-out SHALL remove the stored preferences with the local vault data.

#### Scenario: Preferences restore
- **WHEN** the user changes the length and character sets and reopens the generator
- **THEN** the saved options are restored

#### Scenario: Storage unavailable
- **WHEN** the local store cannot be opened
- **THEN** the generator uses defaults and remains usable

#### Scenario: Sign-out cleanup
- **WHEN** the user signs out
- **THEN** no generator preference record remains in local vault storage

### Requirement: TOTP secret parsing

TOTP parsing SHALL accept raw Base32 containing spaces, lowercase, or optional padding, and `otpauth://` TOTP URIs. It MUST reject invalid Base32 and unsupported algorithm, digit count, or period values. The item editor SHALL accept the same raw or URI inputs.

#### Scenario: Raw Base32
- **WHEN** a secret contains spaces and lowercase letters
- **THEN** it is normalized and accepted

#### Scenario: OTP auth URI
- **WHEN** an `otpauth://totp/...` URI contains a valid Base32 secret
- **THEN** the secret is accepted

#### Scenario: Unsupported parameters
- **WHEN** a URI requests SHA-256, eight digits, or a non-30-second period
- **THEN** the input is rejected with an inline error

#### Scenario: Invalid secret
- **WHEN** the secret contains invalid Base32 characters or padding
- **THEN** no code is shown and an inline error is displayed

### Requirement: Item TOTP display

For a login item with a valid TOTP secret, the client SHALL generate RFC 6238 SHA-1, six-digit, 30-second codes entirely in the browser. Item detail SHALL show the grouped code and a countdown and rotate at the step boundary without sending the secret to the server.

#### Scenario: Current code
- **WHEN** the detail for an item with a valid secret is open
- **THEN** the current six-digit code and countdown are visible

#### Scenario: Step boundary
- **WHEN** the 30-second step changes
- **THEN** the displayed code and countdown update once at the boundary

#### Scenario: No server secret
- **WHEN** an item TOTP code is generated
- **THEN** no request contains the TOTP secret or generated code

#### Scenario: Invalid item secret
- **WHEN** the saved secret cannot be parsed
- **THEN** the detail shows an inline error instead of a code

### Requirement: Clipboard lifecycle

Copy actions SHALL show confirmation, cancel any pending clipboard clear, and schedule a best-effort clear after 30 seconds only when the clipboard still contains the copied value. When verification is unavailable, the UI MUST instruct the user to clear the clipboard manually. Vault lock and route change SHALL clear any pending clipboard value.

#### Scenario: Copy confirmation
- **WHEN** the user copies a generated value, password, or TOTP code
- **THEN** a confirmation toast appears with a manual-clear hint

#### Scenario: New copy replaces timer
- **WHEN** a second secret is copied before the first timer expires
- **THEN** the first clear timer is cancelled and only the latest value is scheduled

#### Scenario: Clipboard changed externally
- **WHEN** the clipboard no longer contains the copied value at expiry
- **THEN** the clear operation does not overwrite the external value

#### Scenario: Lock clears clipboard
- **WHEN** the vault locks with a pending clipboard clear
- **THEN** the pending clipboard value is cleared

### Requirement: Reveal lifecycle

Password reveal SHALL auto-hide after 30 seconds and reset on route change, vault lock, and window blur. Reveal state MUST NOT be persisted in storage or the URL.

#### Scenario: Reveal timeout
- **WHEN** a password is revealed and 30 seconds pass
- **THEN** the password is hidden again

#### Scenario: Route change
- **WHEN** the user navigates away with a password revealed
- **THEN** the next reveal state is hidden

#### Scenario: Lock and blur
- **WHEN** the vault locks or the window loses focus
- **THEN** the revealed value is hidden
