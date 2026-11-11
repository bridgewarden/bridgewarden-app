# Spec Delta

## ADDED Requirements

### Requirement: Configurable idle auto-lock

The client SHALL support an idle timeout of 1, 5, 15, 30, or 60 minutes, or never. The default MUST be 15 minutes. A timeout expiration SHALL call `lockVault()`, retaining IndexedDB ciphertext, wrapped key material, and the server session.

#### Scenario: Timeout expires
- **WHEN** the vault is unlocked and no qualifying activity occurs for the configured duration
- **THEN** the vault locks and the overlay requires the master password

#### Scenario: Activity resets the deadline
- **WHEN** the user produces pointer, keyboard, touch, or scroll activity before the deadline
- **THEN** the timeout restarts from that activity

#### Scenario: Never times out
- **WHEN** the configured value is `never`
- **THEN** no idle timer locks the vault, while manual lock remains available

#### Scenario: Invalid preference
- **WHEN** stored preference data is missing or invalid
- **THEN** the client uses 15 minutes

### Requirement: Optional lock on tab hide

The client SHALL provide a default-off preference to lock when the document becomes hidden. When enabled, hiding the tab MUST lock immediately. When disabled, the idle deadline continues to apply.

#### Scenario: Hide lock enabled
- **WHEN** the document becomes hidden and the preference is enabled
- **THEN** the vault locks immediately

#### Scenario: Hide lock disabled
- **WHEN** the document becomes hidden and the preference is disabled
- **THEN** the vault stays unlocked until the idle deadline or manual lock

#### Scenario: Return after the deadline
- **WHEN** the document becomes visible after the idle deadline passed
- **THEN** the vault locks before the unlocked UI is shown

### Requirement: Lock propagation across tabs

A manual or automatic lock in one tab SHALL clear the in-memory key in sibling tabs of the same browser profile. A locked sibling on a protected route MUST show the locked overlay.

#### Scenario: Sibling tab locks
- **WHEN** one unlocked tab locks
- **THEN** another unlocked tab in the same browser profile clears its key and requires the master password

### Requirement: Non-sensitive preference storage

Auto-lock preferences SHALL be stored outside the vault key path and MUST NOT contain plaintext, wrapped keys, the master password, or tokens. The preference SHALL persist across reloads on the device.

#### Scenario: Preference resets for a new session
- **WHEN** the user signs out or authenticates after an unauthenticated visit
- **THEN** the policy returns to 15 minutes and hide-lock off

#### Scenario: Preference persists
- **WHEN** the user selects 30 minutes and reloads
- **THEN** the setting still reads 30 minutes

#### Scenario: No secrets in preference storage
- **WHEN** preference storage is inspected
- **THEN** it contains only the timeout and tab-hide values
