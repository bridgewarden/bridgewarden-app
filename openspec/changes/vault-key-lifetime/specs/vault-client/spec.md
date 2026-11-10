# Spec Delta

## ADDED Requirements

### Requirement: In-memory vault key lifetime

The unwrapped vault key SHALL live only in module-scoped memory. The client SHALL expose lock state through a subscription/snapshot interface, and `lock()` SHALL zero the key, clear future decrypted selector state, and retain IndexedDB ciphertext, wrapped-key material, and the server session.

#### Scenario: Manual lock
- **WHEN** an unlocked user invokes lock
- **THEN** the in-memory key is gone, the app is locked, and ciphertext/cache/session remain

#### Scenario: Key is not in storage
- **WHEN** localStorage, sessionStorage, and IndexedDB are inspected after unlock
- **THEN** no unwrapped vault key is present

#### Scenario: Navigation does not re-prompt
- **WHEN** an unlocked user navigates between vault routes
- **THEN** the key remains in memory and no password prompt appears

### Requirement: Local unlock without server round-trip

`unlock(password)` SHALL read the active wrapped key material from IndexedDB, derive the master/wrap key, unwrap the vault key, and set it in memory. It MUST work while the page is loaded without a network request. A wrong password MUST leave the app locked with a generic error.

#### Scenario: Correct password
- **WHEN** the user enters the correct master password while locked
- **THEN** the cached wrapper is unwrapped locally and the app unlocks

#### Scenario: Wrong password
- **WHEN** the user enters a wrong password
- **THEN** the app stays locked and no key is stored

#### Scenario: No cached material
- **WHEN** wrapped key material is missing or expired
- **THEN** local unlock is unavailable and the overlay offers sign-out/login

### Requirement: Five failed unlocks force sign-out

The client SHALL count consecutive invalid local unlock attempts per tab. On the fifth failure it MUST lock the key, stop accepting passwords, and force the full sign-out flow, which revokes the session and wipes local vault data. A successful unlock or completed sign-out clears the counter.

#### Scenario: Fifth wrong password
- **WHEN** the user enters five wrong master passwords in a row
- **THEN** the app signs out, revokes the session, and wipes local vault data

#### Scenario: Correct password after lockout
- **WHEN** the counter already reached five and the user submits the correct password
- **THEN** the app still signs out instead of unlocking

### Requirement: Reload starts locked

An authenticated document render with no in-memory key SHALL be treated as locked. The server/initial snapshot MUST NOT present unlocked vault content before hydration confirms the key.

#### Scenario: Reload authenticated app
- **WHEN** the browser reloads `/app` with a valid session
- **THEN** the shell renders locked until local unlock succeeds
