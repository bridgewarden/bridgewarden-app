# Spec Delta

## MODIFIED Requirements

### Requirement: Step-up re-proof protection

Password re-proof for 2FA enrollment, disable, and backup-code regeneration SHALL use IP and identity rate limits plus dedicated step-up failure accounting and lockout. A wrong proof MUST NOT be an unlimited password oracle, and a step-up lockout MUST NOT lock password login. After `step_up_locked_until` expires, the next correct proof SHALL verify and reset the step-up failure counter; a successful master-password rotation or recovery reset SHALL clear the step-up failure and lock state.

#### Scenario: Repeated wrong proof
- **WHEN** a session holder sends repeated wrong password proofs to a 2FA management action
- **THEN** the step-up budget/failure counter advances toward a step-up lockout

#### Scenario: Locked account
- **WHEN** the account is locked and a 2FA management proof is submitted
- **THEN** the request is rejected before password verification with the locked-account response

#### Scenario: Expired step-up lock
- **WHEN** the step-up lock deadline has passed and the account submits the correct master-password proof
- **THEN** the proof is accepted, 2FA management proceeds, and the step-up failure counter is reset

#### Scenario: Credential rotation clears step-up lock
- **WHEN** the owner successfully rotates the master password or completes recovery reset
- **THEN** the step-up failure and lock state are cleared

#### Scenario: Correct proof at the threshold
- **WHEN** the ninth step-up attempt succeeds with the correct master password
- **THEN** the proof is accepted and the counter is reset without arming a lock

#### Scenario: Successful factor change
- **WHEN** 2FA is enrolled, disabled, or backup codes are regenerated
- **THEN** the current session remains valid and other sessions are revoked through the session-version check
