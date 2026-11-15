# Proposal

## Why

The shell still exposes a disabled lock button and a sign-in icon on public auth pages, uses neutral shadcn defaults instead of the approved technical-utility system, and implements the locked state as a hand-rolled dialog without a focus trap or dependable focus restore. PR 1 makes the shared frame correct before individual pages are redesigned.

## What Changes

- Apply the approved Signal token direction in `app/app.css`: cool paper/ink, cobalt primary/ring, system sans + system mono roles, tighter control geometry, and preserved `light-dark()` behavior.
- Split the header into a public variant (brand + theme only) and an authenticated variant (navigation, lock, account menu).
- Mark the active navigation item with `aria-current`, keep admin navigation admin-only, and show account identity in the mobile menu.
- Replace the hand-rolled locked overlay with a Radix Dialog-based overlay: focus trap, focus restore, no Escape dismissal, visible busy/sign-out state, and a brief lockout message before sign-out.
- Keep the shell content width and layout stable so page-level PRs can change content inside it.
- No `PageHeader` or `SectionNav` in this PR; those land with their first consumers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-shell`: public and authenticated header variants, active navigation, mobile account identity, and a focus-managed locked overlay.

## Impact

- `app/app.css`, `app/components/app-header.tsx`, `app/components/app-shell.tsx`, `app/components/locked-overlay.tsx`, `app/lib/i18n/en.ts`.
- `e2e/auth.spec.ts` and `e2e/a11y-app.spec.ts` expectations for the public header and locked overlay.
- No routes, server handlers, database, auth, crypto, or dependency changes.
- No vault plaintext or key material enters the shell, screenshots, or tests.
