# Proposal

## Why

The app currently renders a bare landing page: Tailwind is imported, but there are no design
tokens, no shared primitives, no persistent shell, and every string is hardcoded. Each remaining
PR (auth, vault, editors, generator) would otherwise invent its own colors, spacing, focus
styles, and copy, which makes the UI inconsistent and blocks the accessibility and performance
work scheduled later. Establishing tokens, primitives, a shell, and one copy catalog now keeps
those PRs small and reviewable.

## What Changes

- Define light and dark design tokens in `app/app.css` (background, foreground, muted, primary,
  destructive, border, ring, radius) and use a system font stack. No remote fonts.
- Generate the MVP shadcn/ui primitives into `app/components/ui/`: button, input, label, textarea,
  select, checkbox, dialog, alert-dialog, dropdown-menu, toast, tooltip, sheet, skeleton, badge,
  switch, and tabs.
- Add a persistent `AppShell` in `app/components/app-shell.tsx` with the product mark, header
  action slots (lock and user menu), theme toggle, and a constrained content container. It stays
  usable down to 360px.
- Add a theme control that persists light/dark/system in the non-sensitive `bw_theme` cookie, lets
  the root loader apply the class during SSR, and writes the cookie before changing the DOM class.
- Add a flat English copy catalog at `app/lib/i18n/en.ts` with a typed `t(key, params?)` helper
  that throws in development when a key is missing.
- Register placeholder routes and feature page entries for `/login`, `/setup`, `/app`, and
  `/app/trash`, each rendering inside the shell with catalog-backed headings.

## Capabilities

### New Capabilities

- `design-system`: design tokens, typography, generated primitives, and the rules that keep
  hand-written UI consistent with them.
- `app-shell`: the persistent frame, header action slots, navigation, and responsive behavior
  shared by every page.
- `copy-catalog`: a single English source of user-facing strings with a typed lookup and defined
  missing-key behavior.

### Modified Capabilities

None. No existing capability changes behavior.

## Impact

- UI and styling: `app/app.css`, `app/root.tsx`, `app/components/`, `app/features/`,
  `app/lib/i18n/`, `app/routes.ts`, plus placeholder route modules under `app/routes/`.
- Dependencies: shadcn/ui runtime packages (Radix primitives, `class-variance-authority`, `clsx`,
  `tailwind-merge`, `lucide-react`, `sonner`) where not already installed.
- Tests: the existing health route test must keep passing; new tests cover catalog lookup, theme
  cookie parsing, and the root loader's theme resolution. The shell is verified by build, SSR
  markup inspection, and a viewport pass until Playwright lands in PR #5.
- No server, D1, KV, crypto, or secret changes. The `/health` route and Worker bindings are
  untouched.
