# Design

## Context

See proposal.md for motivation. Current state that shapes the approach:

- React Router v8 framework mode with SSR, served by the Cloudflare Worker.
- Tailwind CSS v4 is already wired through `@tailwindcss/vite`; `app/app.css` holds a minimal
  `@theme` block with a system font stack.
- `app/root.tsx` renders the document shell but has no theme handling and no shared chrome.
- `app/routes.ts` registers only `/` and `/health`. There is no `components/ui`, no feature
  directory, and no message catalog.
- The test harness is Vitest with `@cloudflare/vitest-plugin` (Workers runtime). There is no DOM
  test environment yet; Playwright is scheduled for PR #5.
- CSP hardening is scheduled later (PR #19), so this design avoids inline scripts where possible.

## Goals / Non-Goals

**Goals:**

- One token source that light and dark themes both derive from.
- Shared primitives that are owned source, not a runtime component package.
- A shell that every page renders inside, with stable header slots for later auth work.
- Theme preference that survives reload and does not flash before hydration.
- A typed copy catalog that a second locale can be added to without editing components.
- Placeholder routes that establish the feature-per-page layout used by later PRs.

**Non-Goals:**

- Auth, session, lock behavior, or vault data. Header slots are placeholders only.
- Final visual design of the vault list, editors, or generator.
- Playwright and accessibility automation (PR #5 and PR #19).
- A theme editor or per-user theme persistence on the server.
- Component documentation site or Storybook.

## Decisions

### D1. shadcn/ui as owned source, Radix for behavior

Use the shadcn/ui CLI to generate primitives into `app/components/ui/`, with Radix packages for
behavior (dialog focus trap, dropdown keyboard navigation) and `class-variance-authority` for
variants. The generated files are committed and owned by this repository.

Alternatives: hand-writing every primitive (slow, easy to get focus management wrong) or using a
runtime library such as Radix Themes or Mantine (adds a styled runtime, fights Tailwind tokens,
harder to keep the bundle small). Owned source keeps the visual language under our control and
lets PR #19 audit components directly.

Risk: the shadcn CLI may not detect React Router v8. Fallback: create `components.json` by hand
and add components from the registry, copying only the primitives listed in the proposal.

### D2. Tailwind v4 CSS-first tokens with a class-based dark variant

Keep tokens in `app/app.css` using `@theme` and CSS variables, and enable class-based dark mode
with `@custom-variant dark (&:where(.dark, .dark *));`. Raw color values are not used in
components; they reference semantic roles.

Alternatives: a `tailwind.config.js` theme (v4 prefers CSS-first) or media-query-only dark mode
(cannot support an explicit user choice).

Each token is declared once with `light-dark()`, so light, dark, and system cannot drift. This
requires `light-dark()` support (Chrome/Edge 123+, Safari 17.5+, Firefox 120+); older browsers are
outside the project's evergreen target.

### D3. Theme preference in a cookie, applied during SSR

Store the preference in a non-sensitive cookie `bw_theme` with values `light`, `dark`, or
`system`. `root.tsx` reads it in its loader, resolves `system` on the server where possible, and
sets the class on `<html>` during SSR. The client toggle updates the cookie and the document class.

Rationale: a cookie lets SSR emit the correct class, so there is no flash and no inline script.
That matters because PR #19 introduces a nonce-based CSP that would otherwise need an exception for
a blocking theme script.

Alternatives: localStorage plus an inline pre-hydration script (flash-free but needs a CSP
exception) or a server-side user setting (requires auth, which does not exist yet).

Trade-off: the cookie is sent with requests and is readable by JavaScript. It holds no personal
data, so it is not `HttpOnly`; the client must be able to change it.

### D4. i18n as a typed module, not a library

Implement `app/lib/i18n/en.ts` as a flat object with `as const`, derive a key union, and expose
`t(key, params)` with `{name}` interpolation. In development a missing key throws; in production
it returns the key text so a page never crashes on copy.

Alternatives: `i18next` or `react-intl` (runtime weight and configuration for a single locale) or
`Intl` message formats (premature before plurals are needed). The module can be replaced later
without changing components if the lookup signature stays stable.

### D5. One feature per page, routes stay transport-only

Register `/login`, `/setup`, `/app`, and `/app/trash` in `app/routes.ts`. Each route module renders
`app/features/<feature>/<feature>.tsx` through its `index.ts`, matching AGENTS.md. Placeholder
pages contain only a catalog-backed heading and a short explanation.

Alternative: one placeholder component reused by all routes. That would not establish the feature
layout the next PRs depend on.

### D6. Component helpers and naming

`cn` lives in `app/lib/class-names.ts` (not `lib/utils.ts`) and `components.json` points its
`utils` alias there. Primitives are kebab-case files in `app/components/ui/`, and the shell is
`app/components/app-shell.tsx`.

### D7. Testing scope for this change

Catalog lookup, parameter interpolation, and missing-key behavior are pure functions and are tested
in the existing Workers Vitest project. The shell is verified through the build, SSR response
inspection for landmarks, and a manual 360/768/1280 viewport pass. Full browser automation is
deferred to PR #5, which adds Playwright.

Risk: without a DOM test environment, a regression in client-only shell behavior is only caught by
the build or manually. Accepted for one PR because the shell has no data logic.

## Risks / Trade-offs

- [shadcn CLI cannot resolve React Router v8] -> Create `components.json` manually and copy the
  needed primitives from the registry; verify each file typechecks.
- [Theme cookie and client state drift] -> The cookie is the single source; the toggle writes the
  cookie before updating the document class, and SSR always re-derives the class from the cookie.
- [Primitive set bloats the initial bundle] -> Primitives are separate modules and tree-shaken by
  route; PR #19 measures the budget and trims unused ones.
- [Tailwind v4 dark variant syntax changes] -> Verify with a build and a rendered response that the
  `dark` class changes token values; keep the variant declaration in one place.
- [Copy catalog keys drift from components] -> The key union is derived from the catalog, so an
  unknown key fails typecheck; the development throw catches dynamic misuse.
- [Radix and sonner set inline style attributes] -> Radix positions overlays and sonner sets
  CSS variables through `style` attributes, which a nonce cannot authorize. PR #19 must either
  allow `style-src-attr 'unsafe-inline'` for these primitives or replace them; recorded here so
  the CSP task accounts for it.

## Migration Plan

- No data migration. This change is additive UI scaffolding.
- Ship in one PR on `feat/ui-foundation`, committed atomically: tokens, primitives, catalog,
  shell and theme, placeholder routes.
- Rollback is a revert of the branch. No stored state depends on these files.
- After merge, later PRs import tokens and primitives instead of redefining styles.
