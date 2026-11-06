# Tasks

## 1. Dependencies and component tooling

- [x] 1.1 Add the shadcn/ui runtime dependencies (Radix primitives used by the chosen components, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`) and verify `pnpm install` succeeds and `pnpm typecheck` still exits 0.
- [x] 1.2 Create `components.json` with aliases for `components`, `ui`, and a `utils` alias pointing at `app/lib/class-names.ts`, implement `cn` there, and verify an import of `cn` typechecks.
- [x] 1.3 Generate the MVP primitives into `app/components/ui/` (button, input, label, textarea, select, checkbox, dialog, alert-dialog, dropdown-menu, toast, tooltip, sheet, skeleton, badge, switch, tabs). If the CLI cannot detect React Router v8, copy the same primitives from the shadcn registry. Verify every generated file typechecks and `pnpm build` exits 0.

## 2. Tokens and theme

- [x] 2.1 Define semantic tokens (background, foreground, muted, muted-foreground, primary, primary-foreground, destructive, border, input, ring, radius) for light and dark in `app/app.css`, declare `@custom-variant dark (&:where(.dark, .dark *))`, and verify a production build succeeds and the generated CSS contains both token sets.
- [x] 2.2 Add a theme preference helper in `app/lib/theme.ts` that parses and serializes the `bw_theme` cookie (`light`, `dark`, `system`) and verify unit tests cover valid values, an invalid value, and a missing cookie.
- [x] 2.3 Read the theme cookie in the root loader, set the `dark` class on `<html>` during SSR, and add a theme control that writes the cookie and updates the document class. Verify the server response already carries the correct class and that the choice survives a reload with no light flash.
- [x] 2.4 Document the token and `cn` rules in the AGENTS.md UI section and verify the documented aliases match `components.json`.

## 3. Copy catalog

- [x] 3.1 Create `app/lib/i18n/en.ts` with flat namespaced keys and a `t(key, params)` lookup that interpolates `{name}` placeholders. Verify unit tests cover a direct lookup, parameter interpolation, a development throw for a missing key, and a production fallback that returns the key.
- [x] 3.2 Replace the hardcoded strings in the landing page and the new placeholder pages with catalog keys. Verify a grep of those components finds no user-facing literals.

## 4. App shell

- [x] 4.1 Build `app/components/app-shell.tsx` with a header (product mark, lock action slot, user menu slot, theme control), a single main landmark, and a constrained content container. Verify the server-rendered HTML for `/` contains a banner and one main landmark.
- [x] 4.2 Wire the shell around all page routes while leaving `/health` as a JSON resource route. Verify `/` returns HTML with the shell and `/health` still returns `{"ok":true}` without shell markup.
- [x] 4.3 Make the header responsive and keep touch targets at least 44px. Verify at 360px, 768px, and 1280px that the header actions are reachable and `document.documentElement.scrollWidth` does not exceed the viewport width.

## 5. Placeholder pages and routes

- [x] 5.1 Create feature entries `app/features/login`, `app/features/setup`, `app/features/vault-list`, and `app/features/vault-trash`, each with `<feature>.tsx` and an `index.ts` default export and a catalog-backed heading. Verify each entry is imported without type errors.
- [x] 5.2 Register `/login`, `/setup`, `/app`, and `/app/trash` in `app/routes.ts`, rendering the matching feature entry. Verify each URL returns 200 and shows its catalog heading inside the shell.

## 6. Integration verification

- [x] 6.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build` and confirm all exit 0.
- [x] 6.2 Confirm the rendered pages make no third-party font, script, or analytics requests and that components emit no inline `<style>` or `<script>` beyond React Router's own hydration scripts.
- [x] 6.3 Confirm theme persistence and catalog coverage end to end: switch to dark, reload, and verify the class and rendered copy; then verify a missing key fails typecheck rather than shipping.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Open the PR with change id `design-system-shell` and requirement `TASK-5`.
- Archive the change after the PR is merged.
