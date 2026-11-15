# Proposal

## Why

Login and recovery are still bare `max-w-md` columns inside the authenticated-width frame. They do not use the merged shell's composition, do not offer a visible recovery entry, and recovery has no back step or field-specific validation. PR 2 completes the public authentication entry so the first screen a user sees matches the technical-utility system.

## What Changes

- Add a shared public `AuthFrame`: an intro and a `Card`-based form panel, centered within the shell, responsive at 320/390/1440, with one page `h1` and no duplicated brand.
- Login: add factual guidance and trust points, email focus, full-width primary action, separate email/password errors, form-level `Alert`, and a "Use a recovery key" link to `/recover`.
- Login 2FA: keep code focus, disable the code input while busy, and separate the verify action from the secondary mode/back actions.
- Recovery: add a step back action, per-field errors, password strength and mismatch parity, a `Card` success panel, safe recovery-key download cleanup, and an explicit return to sign-in.
- Extract password scoring to a shared `app/lib` helper so recovery does not import the setup feature; setup only changes its import.
- Extend auth, recovery, public a11y, and responsive tests, including 320/390/1440 auth widths.
- No authentication, server, crypto, route, database, or dependency change. Setup and member onboarding remain PR 3.

## Capabilities

### New Capabilities

- `auth-pages`: public login, two-factor challenge, and recovery page composition, validation, guidance, and recovery-key handoff.

### Modified Capabilities

None.

## Impact

- New `app/components/auth-frame.tsx`.
- `app/features/login/**` and `app/features/recover/**`.
- `app/lib/password-policy.ts` or a new shared password-strength helper; update the setup import without changing setup UI.
- `app/lib/i18n/en.ts`.
- `e2e/auth.spec.ts`, `e2e/recover.spec.ts`, `e2e/a11y-app.spec.ts`, `e2e/responsive.spec.ts`.
- No route modules, server handlers, migrations, auth/crypto logic, or dependencies.
- No vault plaintext, master password, vault key, recovery key, or token enters logs, screenshots, or test artifacts.
