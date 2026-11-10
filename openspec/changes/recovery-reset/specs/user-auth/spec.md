# Spec Delta

## ADDED Requirements

### Requirement: Uniform recovery lookup

The recovery lookup SHALL accept an email and return only the account's recovery-wrapped vault key and IV. Known and unknown emails MUST receive the same status and field shape. Unknown emails SHALL receive deterministic synthetic wrapper and IV values derived from the configured pepper so repeated requests cannot reveal account existence. The response MUST NOT contain the master auth hash, KDF parameters, vault wrapper, tokens, or recovery proof.

#### Scenario: Known email lookup
- **WHEN** a client submits the email of an account with recovery material
- **THEN** the response contains that account's recovery wrapper and IV

#### Scenario: Unknown email lookup
- **WHEN** a client submits an email that does not exist
- **THEN** the response has the same status and shape with deterministic synthetic wrapper and IV values

#### Scenario: No credential material in lookup
- **WHEN** any recovery lookup response is inspected
- **THEN** it contains no master auth hash, KDF parameters, vault wrapper, session token, or recovery proof

### Requirement: Recovery proof verification

A recovery reset SHALL require a proof derived from the recovery secret with a domain separate from the vault wrap key. The server MUST verify the submitted proof against the stored recovery auth hash with `HMAC-SHA256(AUTH_PEPPER, proof || recoveryServerSalt)` and a constant-time comparison. Wrong proof, missing account, unknown email, and an account without recovery proof MUST return the same generic failure and MUST NOT mutate credentials.

#### Scenario: Correct recovery proof
- **WHEN** a reset request presents proof matching the stored recovery verifier
- **THEN** the reset may proceed

#### Scenario: Wrong recovery proof
- **WHEN** a reset request presents a non-matching proof
- **THEN** the response is a generic failure and the user row is unchanged

#### Scenario: Account without recovery proof
- **WHEN** a pre-migration account has no stored recovery verifier
- **THEN** the response is the same generic failure and no password material changes

### Requirement: Recovery reset rotates and burns credentials

A successful recovery reset SHALL replace the server auth hash, server salt, KDF parameters, vault-key wrapper, recovery-key wrapper, and recovery proof in one guarded update, increment the session version, and issue a new session for the resetting device. Every previous session MUST be rejected on its next request. The old recovery key MUST fail after the reset because both its wrapper and verifier are replaced.

#### Scenario: Successful reset
- **WHEN** the correct recovery proof and valid new password and recovery material are submitted
- **THEN** the account is updated atomically, a new session cookie is issued, and the vault key remains usable

#### Scenario: Old sessions revoked
- **WHEN** a reset completes while another browser holds a session
- **THEN** the other browser is rejected on its next request

#### Scenario: Old recovery key burned
- **WHEN** the account has been reset with a new recovery key
- **THEN** the old recovery key no longer unwraps the vault and no longer satisfies the recovery proof

#### Scenario: Session issuance fails after commit
- **WHEN** the credential update commits but the new session cannot be issued
- **THEN** the client still receives the new recovery key once and is directed to sign in with the new password

#### Scenario: Failed update leaves old credentials
- **WHEN** the guarded update changes no row because of a concurrent reset
- **THEN** the response is a generic failure and the previous credentials remain

### Requirement: Recovery audit

Recovery lookup failures, proof failures, and successful resets SHALL write payload-free audit events. Events MAY include peppered UA and IP hashes but MUST NOT include email, passwords, auth hashes, recovery secrets, proofs, tokens, or ciphertext.

#### Scenario: Failed reset audited
- **WHEN** a reset is rejected
- **THEN** an audit event is written without request secrets

#### Scenario: Successful reset audited
- **WHEN** a reset succeeds
- **THEN** a completion event references the user without any secret material

#### Scenario: Two-factor bypass audited
- **WHEN** a reset succeeds for an account with two-factor authentication enabled
- **THEN** the server records a distinct audit event marking the break-glass bypass
