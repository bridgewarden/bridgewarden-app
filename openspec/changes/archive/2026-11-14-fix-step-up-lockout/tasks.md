# Tasks

## 1. Recoverable step-up lockout

- [x] 1.1 Verify the proof before recording a step-up failure; `recordStepUpFailure` restarts `step_up_failed_count` at 1 after an expired lock, leaves a live lock untouched, and arms the deadline only at the threshold.
- [x] 1.2 Add regression tests for a correct proof at the threshold, a wrong proof after an expired lock that restarts at one and re-locks at ten, and a live lock whose counter/deadline remain unchanged.

## 2. Rotation and recovery clear step-up state

- [x] 2.1 Clear the step-up counter and expired deadline in `rotatePassword` and `resetRecovery` without clearing a live deadline.
- [x] 2.2 Extend the password-change and recovery tests to assert step-up state is cleared after success, a rejected rotation leaves it untouched, and existing login lockout reset semantics remain.
- [x] 2.3 Verify `pnpm vitest run app/features/two-factor/__test__/step-up.test.ts app/features/account-settings/__test__/change-password.test.ts app/features/recover/__test__/recovery.test.ts` passes.

## 3. End-to-end regression

- [x] 3.1 Add a route-level test that a seeded expired lock permits the correct proof (`200`); retain the existing fifty-attempt route test that reaches `423`.
- [x] 3.2 Verify the targeted test(s) pass and no other session or login lockout behavior changes.

## 4. Sandbox verification

- [x] 4.1 Re-run the Docker sandbox probe for the expired-lock correct-password path and record the observed result.
  - Result: Docker probe passed; expired lock accepted the correct password and cleared the counter; live lock still returned `locked`.
- [x] 4.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build`.
  - Result: all pass; 373/373 unit tests; build within 186.7KB/200KB and 149.6KB/150KB budgets.
- [x] 4.3 Run the targeted E2E projects affected by 2FA management and password/recovery flows.
  - Result: two-factor, password-change, and recover — 36/36 pass.

## 5. Integration gate

- [x] 5.1 Run the full verification set and record counts, including the Docker probe and targeted E2E duration.
  - Result: full E2E 60/60; 333.3s informational; Docker probe 2/2 pass.
  - Result: typecheck/lint/format pass; unit and full E2E recorded in the apply report; build within budget.
- [x] 5.2 Confirm no API, schema, dependency, or product UI change beyond the step-up state fix.

## Workflow follow-up

- Archive the change after review and a green gate.
- Re-run `openspec validate --all --strict` after archive.
