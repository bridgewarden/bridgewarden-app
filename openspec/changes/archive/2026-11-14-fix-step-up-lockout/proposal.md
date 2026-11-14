# Proposal

## Why

The dedicated 2FA step-up lockout is currently one-way and reserves a failure before verifying the password. Once `step_up_failed_count` reaches ten, `reserveStepUpAttempt` keeps incrementing it and never restarts the counter after `step_up_locked_until` expires. `verifyPasswordProof` then returns `locked` before checking the password, so the correct master password is permanently rejected and the owner cannot enroll, disable, or regenerate 2FA backup codes without editing D1.

## What Changes

- Verify the submitted proof before recording a step-up failure, then restart the failure counter at one after the previous step-up lock expires.
- Keep the shared login lockout separate: a step-up lock must never lock password login.
- Clear step-up failure and lock state when the owner successfully rotates the master password or completes recovery reset; never clear a live lock from a reset.
- Add regression coverage for expired-lock recovery, the tenth-attempt boundary, and password/recovery clearing.
- No schema migration, dependency, or product UI change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `two-factor-auth`: step-up lockout must be recoverable after its cooling-off period, and successful password rotation or recovery reset must clear step-up lock state.

## Requirement IDs

- TASK-24 — lockout semantics and reset-on-success.
- TASK-26 — master-password rotation clearing.
- TASK-27 — recovery reset clearing.

## Impact

- `app/lib/.server/queries/users.ts` — step-up reservation/reset SQL.
- `app/lib/.server/password-proof.ts` — no behavior change expected beyond the corrected reservation result.
- `app/lib/.server/password-proof.ts` — verify the proof before invoking the step-up failure recorder.
- `app/features/two-factor/__test__/step-up.test.ts` and focused query/route tests.
- No production API, schema, dependency, or UI change.
