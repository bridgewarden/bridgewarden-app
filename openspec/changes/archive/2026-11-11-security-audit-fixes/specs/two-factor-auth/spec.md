# Spec Delta

## ADDED Requirements

### Requirement: Step-up re-proof protection

Password re-proof for 2FA enrollment, disable, and backup-code regeneration SHALL use IP and identity rate limits plus dedicated step-up failure accounting and lockout. A wrong proof MUST NOT be an unlimited password oracle, and a step-up lockout MUST NOT lock password login.

#### Scenario: Repeated wrong proof
- **WHEN** a session holder sends repeated wrong password proofs to a 2FA management action
- **THEN** the step-up budget/failure counter advances toward a step-up lockout

#### Scenario: Locked account
- **WHEN** the account is locked and a 2FA management proof is submitted
- **THEN** the request is rejected before password verification with the locked-account response

#### Scenario: Successful factor change
- **WHEN** 2FA is enrolled, disabled, or backup codes are regenerated
- **THEN** the current session remains valid and other sessions are revoked through the session-version check

## MODIFIED Requirements

### Requirement: Two-factor audit events

Enrollment, successful verification, failures, backup-code use, disable, and regeneration SHALL write
payload-free audit events. Events MUST NOT include TOTP seeds, TOTP codes, backup codes, challenge
tokens, or hashes.

#### Scenario: Verification success and failure are audited
- **WHEN** a challenge attempt succeeds or fails
- **THEN** a corresponding audit event is written without credentials or codes

#### Scenario: Enrollment and disable are audited
- **WHEN** a user enables or disables 2FA
- **THEN** an audit event references that user

#### Scenario: Failed step-up
- **WHEN** a 2FA management proof is wrong
- **THEN** a failed event is recorded and the shared lockout counter advances
