# Tasks

## 1. Shared foundation

- [x] 1.1 Move `passwordScore` into `app/lib/password-policy.ts` and add shared `PASSWORD_STRENGTH_KEYS` using generic `password.strength.*` catalog keys; update setup imports/constants without changing setup markup and verify `pnpm typecheck` and the setup/password unit tests pass.
- [x] 1.2 Add the auth copy catalog entries for login guidance, field errors, recovery steps, strength labels, recovery link, back, and explicit sign-in; verify `pnpm typecheck` and that no component renders a raw literal for a new user-facing string.

## 2. Auth frame and login composition

- [x] 2.1 Add `app/components/auth-frame.tsx` with one page `h1`, guidance area, and a `Card`-based form panel; render login through it and verify an axe scan, one `h1`, no duplicated brand, and no horizontal overflow at 320/390/1440.
- [x] 2.2 Add factual login guidance and trust points, including a "Use a recovery key" link to `/recover`; verify the link navigates, the copy makes no claim about default tab-hide locking, and the page remains readable in both themes.
- [x] 2.3 Rework the login credentials form with initial email focus, separate email/password errors, field error associations, a form-level `Alert`, full-width submit, and first-invalid-field focus; verify `e2e/auth.spec.ts` covers each behavior.
- [x] 2.4 Add or update the login E2E assertions for initial focus, missing email, missing password, form alert, 44-pixel submit, and recovery link; verify the `auth` Playwright project passes.

## 3. Two-factor challenge

- [x] 3.1 Disable the code input and secondary actions while the challenge request is busy, keep verification as the only primary action, and preserve focus when the challenge appears; verify an intercepted delayed `/auth/2fa` request disables the input and the existing two-factor challenge test still passes.
- [x] 3.2 Add a login-challenge assertion for code focus and input busy state; verify the `two-factor` Playwright project passes without enrolling a new account.

## 4. Recovery flow

- [x] 4.1 Add `fieldErrors` to `useRecoveryFlow`, validate recovery-key presence, password length, and confirmation separately, and add `backToEmail` that preserves the email and clears transient values; verify `e2e/recover.spec.ts` covers back, short password, and mismatch with the first invalid field focused.
- [x] 4.2 Render recovery through the shared auth frame with step headings, strength feedback, per-field errors, and a generic live alert for server failures; verify invalid-key failure reveals neither email nor key cause and the `recover` project passes.
- [x] 4.3 Convert the success key result to a bordered panel, fix download cleanup, and add an explicit sign-in action; verify the download contains the key and offline warning, the key is shown once, and the success flow passes in `e2e/recover.spec.ts`.

## 5. Public accessibility and responsive coverage

- [x] 5.1 Extend `e2e/a11y-app.spec.ts` with login and recovery scans after setup, because the public pages redirect to `/setup` before bootstrap; verify zero critical or serious violations and that login email focus is asserted.
- [x] 5.2 Extend `e2e/responsive.spec.ts` with auth-page checks at 320, 390, and 1440 for no horizontal overflow, one `h1`, and 44-pixel primary actions; verify the `responsive` and `a11y-app` projects pass.

## 6. Integration

- [x] 6.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and the full `pnpm test:e2e`; verify no route, server, migration, auth/crypto, or dependency change appears in the diff.
- [x] 6.2 Capture login and recovery at 320/390/1440 in light and dark; verify no real email, password, recovery key, token, or vault plaintext appears.
- [x] 6.3 Run `openspec validate ux-auth-login-recovery --strict`; verify all tracked tasks are complete before review.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge and a green gate.
- Verify the archived result and keep setup/member onboarding for PR 3.
