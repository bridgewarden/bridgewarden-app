# Proposal

## Why

Setup and invited-member onboarding are the only public task flows still outside the redesigned shell. Setup is a single narrow column with a text step counter, while member setup has no progress, password strength, recovery-key copy/download, or back navigation. PR 3 brings both flows onto one onboarding composition without changing their bootstrap or invitation contracts.

## What Changes

- Add a shared `OnboardingShell`: a step rail with current/done states, a bordered panel, responsive stacking, and a focusable step heading. Use existing catalog labels so the rail does not require new copy.
- Setup: render the four steps (Account, Password, Recovery, Two-Factor) inside the shell; focus the step heading, use full-width primary actions, and add safe back navigation.
- Member setup: render Password and Recovery as two rail steps with the invitation identity shown as a read-only summary; add password strength, recovery-key copy/download, confirmation feedback, safe back navigation, and a clear invalid-invitation exit.
- Extract recovery-key copy/download behavior into shared app UI/hooks so setup and member setup do not duplicate it.
- Keep the optional two-factor step informational. Do not add a fake QR or enrollment path before server-side enrollment exists.
- Extend setup/member E2E, public/auth a11y, and responsive coverage at 320/390/1440.
- No server, route, token, bootstrap, crypto, migration, or dependency change.

## Capabilities

### New Capabilities

- `onboarding-pages`: shared step rail and panel composition for first-run setup and invited-member onboarding, including step focus, safe back navigation, password strength, recovery-key actions, and invalid-invitation presentation.

### Modified Capabilities

None. `account-bootstrap` and `member-setup` remain the server contracts; this change is the UI composition over those flows.

## Impact

- New `app/components/onboarding-shell.tsx` and shared recovery-key action UI/hook.
- `app/features/setup/**` and `app/features/member-setup/**`.
- `e2e/setup.spec.ts`, `e2e/admin-users.spec.ts`, `e2e/a11y-app.spec.ts` or `e2e/a11y-public.spec.ts`, and `e2e/responsive.spec.ts`.
- `app/lib/i18n/en.ts` only if an existing key cannot be reused; the current catalog has no room for new copy.
- No route modules, server handlers, migrations, auth/crypto logic, or dependencies.
- No vault plaintext, master password, vault key, recovery key, token, or confirmation value enters logs, screenshots, or test artifacts.
