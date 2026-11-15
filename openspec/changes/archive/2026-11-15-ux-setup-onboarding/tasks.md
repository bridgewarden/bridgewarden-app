# Tasks

## 1. Onboarding shell and setup

- [x] 1.1 Add `app/components/onboarding-shell.tsx` with a step rail, bordered panel, desktop rail layout, mobile stack, and existing setup/member labels; render `SetupWizard` through it and verify one `h1`, one `aria-current="step"`, and no horizontal overflow at 320/390/1440.
- [x] 1.2 Move setup focus to the page `h1` on initial load and the step heading after step changes; update `e2e/setup.spec.ts`/`e2e/a11y-public.spec.ts` expectations and verify focus with Playwright.
- [x] 1.3 Add the setup `back-to-password` action, clear generated transport/recovery/vault-key material, expose back from Recovery only, keep Two-Factor terminal, and verify the setup E2E back flow.
- [x] 1.4 Make setup primary actions full-width at narrow widths and keep the Two-Factor step informational with no QR/secret/enrollment control; verify setup completion still creates no `user_2fa` row.

## 2. Shared recovery-key actions

- [x] 2.1 Move recovery copy/download behavior to `app/hooks/use-recovery-actions.ts` and extract the key/actions UI into `app/components/`, reusing existing setup/recovery copy keys and the 60-second clipboard clear.
- [x] 2.2 Replace setup's inline recovery actions with the shared UI and verify setup copy/download/confirmation E2E, including offline warning and no recovery key in the request body.
- [x] 2.3 Verify the shared component has no duplicate download implementation and that object URLs are revoked after the click task.

## 3. Member onboarding

- [x] 3.1 Render member setup through `OnboardingShell` with a two-step Password/Recovery rail, read-only invitation identity summary, and a generic invalid-invitation state with a sign-in action; verify valid and invalid token E2E.
- [x] 3.2 Use shared `isMasterPasswordAcceptable`, `passwordScore`, and `PasswordStrengthMeter` in member setup; add explicit error mapping instead of a template-key cast and verify short/mismatch/no-generation behavior.
- [x] 3.3 Use the shared recovery-key actions and confirmation flow in member Recovery; add back-to-password that clears material/vault key/confirmation and verify the member E2E back and recovery flow.
- [x] 3.4 Add member heading focus on initial load and step changes; verify focus and accessible error associations.

## 4. Public accessibility and responsive coverage

- [x] 4.1 Extend a11y coverage for setup and member setup after the appropriate bootstrap state; verify zero critical or serious violations and step-heading focus.
- [x] 4.2 Extend responsive coverage for setup/member at 320/390/1440 with no horizontal overflow, one `h1`, and 44-pixel primary actions.

## 5. Integration

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and full `pnpm test:e2e`; verify no server, route, migration, crypto, token, or dependency change and keep the vault bundle at or below 150.0 KB.
- [x] 5.2 Capture setup and member onboarding at 320/390/1440 in light/dark; verify no password, recovery key, token, or real email appears.
- [x] 5.3 Run `openspec validate ux-setup-onboarding --strict`; verify all tracked tasks are complete before review.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge and a green gate.
- Verify the archived result and keep PR 4 for authenticated vault surfaces.
