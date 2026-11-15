# Design

## Context

See `proposal.md` for motivation and `specs/auth-pages/spec.md` for the behavior contract. The public shell already provides a brand and theme control, so the auth pages only need content composition. Login and recovery currently duplicate a bare `max-w-md` column and share one generic error shape. Setup owns the only password-strength scorer; features cannot import another feature.

## Goals / Non-Goals

**Goals:**
- One public auth composition used by login and recovery.
- Field-level validation that points to the affected control.
- A recovery flow with a working back step, strength/mismatch feedback, and a safe one-time key handoff.
- Reuse the existing auth requests and server responses unchanged.
- Keep setup UI untouched while making its password scorer shared.

**Non-Goals:**
- Redesigning setup or member onboarding; those belong to PR 3.
- Adding password reset by email, account enumeration changes, passkeys, or new routes.
- Changing login, 2FA, recovery, crypto, session, rate-limit, or audit behavior.
- Building a route-level auth layout. `AppShell` remains the only frame.

## Decisions

### Public auth frame

Add `app/components/auth-frame.tsx` as a global component because login and recovery both consume it. It renders a two-column composition: a guidance area with the page `h1`, and a bordered form panel with a heading, description, and children. The panel uses the existing `Card` primitives; the guidance area does not repeat the brand from the public header.

The section uses the shell's available height and a `lg` breakpoint. Below `lg`, it stacks in source order so the intro is read before the form. At 320 pixels the panel uses compact padding and the primary action is full width. This keeps the page centered on desktop without a fixed-height layout that breaks with browser chrome or the mobile keyboard.

Alternative considered: a single centered card with no intro. Rejected because it loses the factual guidance and recovery entry needed on the first screen.

### Login state and focus

`useLoginFlow` replaces the single `fieldError` with `fieldErrors: { email, password }`. `formError` remains the server/rate-limit channel. Each input references only its own error, while the form error renders through `Alert`/`AlertDescription` with an implicit live region.

The email input receives initial focus. The credentials form focuses the first invalid field after local validation. Submit is `w-full min-h-11`; the visible busy status remains a polite live region.

Alternative considered: keep one generic field error. Rejected because both fields appear invalid and the user cannot tell what to fix.

### Two-factor busy state

The challenge form keeps its existing request logic. The code input becomes disabled while `busy`, while verification stays the primary action and mode/back remain outline/ghost. The existing focus-on-challenge effect remains.

### Recovery state and navigation

`useRecoveryFlow` keeps the existing `RecoveryError` for lookup/reset failures and adds `fieldErrors` for local validation plus `backToEmail`. The reset step validates recovery-key presence, password length, and confirmation before deriving anything. Server failures remain one generic form alert; they do not mark a specific field, so the UI cannot reveal whether the email or key failed.

The reset step shows a back action that preserves the email, clears the transient key/password/confirmation values and errors, and returns to the email step. The existing heading-focus effect continues to announce every step change.

### Password strength extraction

Move `passwordScore` into `app/lib/password-policy.ts` and add a shared `PASSWORD_STRENGTH_KEYS` list using generic `password.strength.*` catalog keys. Recovery imports both. Setup changes only its imports/constants and continues to render the same labels; its UI and behavior do not change.

Alternative considered: duplicate the four-rule scorer in recovery. Rejected because two scorers would drift and recovery must not import `features/setup`.

### Recovery-key download

The success panel becomes a bordered result section with copy and download actions. Download appends the temporary anchor, clicks it, removes it, and revokes the object URL after the click task rather than immediately. The downloaded file keeps the key and the offline-storage warning. The success panel always shows an explicit sign-in link; the primary action remains continue-to-vault when a session was issued.

### Tests

- `e2e/auth.spec.ts`: initial email focus, separate missing-field errors, recovery link, full-width action.
- `e2e/recover.spec.ts`: back preserves email, short password and mismatch errors, strength values, invalid-key generic alert, and success key actions.
- `e2e/a11y-app.spec.ts`: login and recovery scans after setup, because the public pages redirect to `/setup` before bootstrap.
- `e2e/responsive.spec.ts`: auth pages at 320, 390, and 1440 with no horizontal overflow and 44-pixel primary actions.

## Risks / Trade-offs

- **Initial autofocus opens the mobile keyboard** → The spec requires email focus; keep it and verify 320/390 layout with the keyboard-free Playwright viewport.
- **Shared strength keys touch setup** → Limit the change to imports/constants and run the setup tests; do not change setup markup.
- **Auth intro copy becomes a security claim** → Use only default behaviors: local unlock, ciphertext storage, and recovery requiring the offline key.
- **Recovery server failures cannot identify the bad field** → Keep one generic alert and per-field only for local validation.
- **A route-level layout would duplicate the shell** → Keep composition inside the feature/page component and leave `routes.ts` unchanged.

## Migration Plan

No data or configuration migration. Deploy as a normal Worker release. Rollback by reverting the UI and copy changes; login/recovery request contracts and stored data are unchanged.
