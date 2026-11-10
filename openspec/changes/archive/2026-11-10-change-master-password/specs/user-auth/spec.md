# Spec Delta

## ADDED Requirements

### Requirement: Authenticated master-password rotation

An authenticated user SHALL change their master password by proving the current password and submitting only newly derived transport material. The server MUST verify the current auth hash, atomically replace the password hash, KDF parameters, and wrapped vault key, and leave vault items unchanged.

#### Scenario: Password rotation succeeds
- **WHEN** a user submits the correct current auth hash and valid new KDF/wrapped-key material
- **THEN** the stored password hash, KDF parameters, and vault-key wrapper are replaced in one update

#### Scenario: Old password stops working
- **WHEN** the password has been rotated
- **THEN** login with the old password returns the generic 401 and login with the new password succeeds

#### Scenario: Wrong current password
- **WHEN** the submitted current auth hash does not match the stored account
- **THEN** the request is rejected and no password or key material is changed

#### Scenario: Failed update leaves old password
- **WHEN** the database update fails
- **THEN** the account remains on the old password and old wrapped key

### Requirement: Password rotation reuses the vault key

Password rotation SHALL unwrap the existing vault key in the browser and re-wrap the same key under the new master key. The server MUST NOT receive the plaintext vault key, master password, or recovery secret. Recovery key material MUST remain valid after the password change.

#### Scenario: Ciphertext untouched
- **WHEN** a password rotation completes
- **THEN** vault item ciphertext and the vault key are unchanged, and only the wrapper changes

#### Scenario: No plaintext secret sent
- **WHEN** the browser submits a password rotation
- **THEN** the request contains only auth hashes, KDF parameters, wrapped keys, and IVs

#### Scenario: Recovery key still works
- **WHEN** the user later unwraps the vault with the existing recovery key
- **THEN** the unwrap succeeds

### Requirement: Rotation revokes other sessions

Password rotation SHALL invalidate every existing session except the current device. The current session MUST be reissued with the new session version.

#### Scenario: Other session rejected
- **WHEN** a second browser has an older session and the password is rotated elsewhere
- **THEN** the older session is rejected on its next request

#### Scenario: Current session remains usable
- **WHEN** rotation completes on the current device
- **THEN** a new cookie is issued and the device continues without re-login
