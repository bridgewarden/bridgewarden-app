# Design

## Context

See `proposal.md` and the `two-factor-auth` delta. The step-up path shares `verifyPasswordProof` with login but uses a dedicated counter (`step_up_failed_count`) and deadline (`step_up_locked_until`). `reserveStepUpAttempt` currently increments unconditionally and never restarts after the deadline; `verifyPasswordProof` rejects a reserved count at or above the threshold before verifying the password. The login path already implements the intended restart-at-one behavior in `recordFailedLogin`.

## Goals / Non-Goals

**Goals:**
- Make the step-up lockout recoverable after its 15-minute cooling-off period.
- Keep step-up failure accounting isolated from the login lockout.
- Clear step-up state after a successful master-password rotation or recovery reset.
- Prove the fix with a deterministic regression test and the existing Docker probe.

**Non-Goals:**
- Changing the 10-attempt threshold or 15-minute duration.
- Adding a new migration, endpoint, UI, or dependency.
- Changing TOTP challenge behavior or the 2FA step-up rate limits.

## Decisions

### Restart the step-up counter in SQL

Move step-up failure recording after password verification and rename the query to `recordStepUpFailure`. It computes the next counter as one when `step_up_locked_until` is non-null and has passed, otherwise `step_up_failed_count + 1`. The correct password at the threshold is therefore accepted instead of being discarded. Set `step_up_locked_until` only when the next counter reaches the threshold; otherwise clear it. This mirrors `recordFailedLogin` and keeps the decision atomic in the same guarded UPDATE.

The WHERE predicate remains `step_up_locked_until IS NULL OR step_up_locked_until <= now`, so a live lock still rejects every proof, including the correct one, before verification. That preserves the intended 15-minute denial and avoids a check-then-act race.

### Clear state on credential rotation and recovery

Add `step_up_failed_count = 0` and clear `step_up_locked_until` only when it is not a live future deadline to the guarded `rotatePassword` and `resetRecovery` updates. A concurrent success must not clear a lock armed by another request. Both already prove ownership with a separate credential, so leaving a stale step-up lock would create an avoidable second lockout. This does not change the audit, session-version, or key-rotation behavior.

### Tests

Extend `app/features/two-factor/__test__/step-up.test.ts` with an expired-lock scenario: seed `step_up_failed_count = 10` and an expired `step_up_locked_until`, submit the correct auth hash, and assert `ok` plus zeroed counters. Add a wrong-proof-after-expiry case that restarts at one and re-locks at ten, a correct-proof-at-threshold case, and a control that a live lock remains unchanged. Add a direct reset CAS test that a live deadline survives. Extend password-change and recovery tests to assert both step-up columns are cleared after success. Re-run the bounded Docker probe against the fixture.

## Risks / Trade-offs

- [SQLite evaluates SET expressions against pre-update values] -> Use the same CASE expression for both assigned columns or derive the new count explicitly; the regression test asserts the returned count and lock state.
- [Counter restart weakens the lockout] -> It restarts only after the configured 15-minute deadline; a live lock still rejects all proofs, and the threshold/duration remain unchanged.
- [Rotation/recovery clear a security counter] -> Those paths already require a stronger independent proof (current master password or recovery key) and bump the session version.

## Migration Plan

No schema migration. Deploy the query and use-case changes together. Rollback restores the previous behavior but must not be used without accepting the permanent-lockout regression.
