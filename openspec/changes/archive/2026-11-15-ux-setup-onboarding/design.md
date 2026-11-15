# Design

## Context

See `proposal.md` for motivation and `specs/onboarding-pages/spec.md` for the behavior contract. Setup currently renders a narrow `max-w-xl` section with a text step count; member setup renders a `max-w-md` panel with no rail, strength meter, recovery actions, or step focus. `PasswordStrengthMeter` and `password-score` are already shared from PR 2. The i18n catalog is at the hard bundle ceiling, so the rail must reuse existing labels.

## Goals / Non-Goals

**Goals:**
- One onboarding frame and rail used by setup and member setup.
- Predictable step focus and safe back navigation.
- Member parity for strength, recovery copy/download, and invalid-invitation exit.
- Shared recovery-key actions instead of duplicate clipboard/download logic.
- Keep the bootstrap and invitation contracts untouched.

**Non-Goals:**
- Real 2FA enrollment during setup; the current step remains informational.
- Server, route, token, crypto, migration, or dependency changes.
- A third "Account" rail step for member setup; identity is a read-only summary above a two-step Password/Recovery rail.
- New catalog copy for rail labels or actions.

## Decisions

### Shared onboarding shell

Add `app/components/onboarding-shell.tsx`, used by `SetupWizard` and `MemberSetupPanel`. It renders a rail (`ol`) and a bordered panel, with a responsive grid at `lg` and stacked layout below it. Step labels come from existing setup/member headings. The rail exposes current/done states through `aria-current="step"` and visual classes; steps are not interactive navigation.

Alternative considered: reuse `AuthFrame`. Rejected because auth pages need a guidance area, while onboarding needs a persistent step rail and a narrower panel.

### Focus behavior

The page `h1` receives focus on initial mount. After a step change, the panel step heading receives focus. `OnboardingShell` exports a stable panel heading id similar to `AuthFrame`, and the setup/member pages own the effects; the shell does not steal focus on every render.

Alternative considered: keep setup's current h1 focus on every step. Rejected because it does not announce the new task and diverges from the step-heading requirement.

### Setup navigation

Add a `back-to-password` setup action. It clears generated transport material and the recovery key, clears the in-memory vault key, and returns to the password step; submitting the password again generates a fresh key and recovery key. Password keeps its existing back-to-account action. The two-factor step is terminal because the recovery key is intentionally discarded after confirmation; no back action is shown.

Alternative considered: allow back from two-factor to recovery. Rejected because the recovery key is no longer in state and re-displaying it would violate the one-time display contract.

### Member step model

Member setup derives two steps from whether generated material exists: Password and Recovery. The invitation identity is a read-only summary above the panel. Recovery back clears the material, recovery key, confirmation, and in-memory vault key, then returns to Password and requires regeneration. The invalid-invitation state uses the shared shell and provides a sign-in link.

### Shared recovery-key actions

Move the setup recovery action hook to `app/hooks/use-recovery-actions.ts` and extract the key display/copy/download UI to `app/components/`. Both setup and member use the shared component, so clipboard clearing, object URL cleanup, and status announcements cannot drift. Existing recovery/setup copy keys are reused.

### Member validation and errors

Member password validation uses shared `isMasterPasswordAcceptable`, `passwordScore`, and `PasswordStrengthMeter`. Recovery confirmation uses the normalized first-six comparison already used by setup. Error rendering uses an explicit key map instead of a template cast.

### Setup and member tests

- Setup: rail current/done, h1 initial focus, step heading focus, back from recovery, copy/download, informational 2FA and finish.
- Member: valid invitation with strength, copy/download, confirmation, back, and invalid token with sign-in action.
- A11y: setup and member setup scans after the appropriate bootstrap state.
- Responsive: setup/member at 320/390/1440 with no overflow and 44-pixel actions.

## Risks / Trade-offs

- **Back from recovery burns the displayed key** → Clear generated material and vault key, regenerate on the next password submit, and require confirmation again.
- **Two-factor users cannot go back to recovery** → Keep the step terminal and state that explicitly in the UI; do not fake a back control.
- **Shared recovery extraction touches setup hook and member flow** → Keep behavior identical, run setup/member/recover tests, and preserve existing copy keys.
- **Catalog is at 153590/153600 bytes** → Reuse existing labels and action copy; no new rail/member strings. Build gate must remain green.
- **Member identity disclosure** → Only render email/display name/role after a valid token; invalid state stays generic.

## Migration Plan

No data or configuration migration. Deploy as a normal Worker release. Rollback by reverting the UI extraction; invitation tokens and bootstrap payloads are unchanged.
