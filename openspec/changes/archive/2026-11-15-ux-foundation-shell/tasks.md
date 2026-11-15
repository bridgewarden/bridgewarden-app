# Tasks

## 1. Token foundation

- [x] 1.1 Map the Signal palette into `app/app.css` using `light-dark()` and preserve the existing Tailwind/shadcn imports; verify the page renders the new paper/ink/cobalt roles in both themes.
- [x] 1.2 Add the system mono role and technical-utility radius overrides (`--radius-md` 6px, `--radius-lg`/`--radius-xl` 8px) in the existing token block; verify buttons/inputs and surfaces use the intended geometry without primitive-specific overrides.
- [x] 1.3 Run the axe checks and inspect 390/1440 screenshots in light and dark; verify body, muted, border, focus, and primary contrast remain readable.

## 2. Header variants

- [x] 2.1 Add a public `AppHeader` variant when `user` is null: product mark and theme control only, no lock action, no account placeholder; verify login/setup/recover pages render it.
- [x] 2.2 Add authenticated navigation active state with `aria-current="page"` and correct Vault matching for `/app`, `/app/new`, and `/app/edit/:id`; verify every nav destination marks exactly one current item.
- [x] 2.3 Add display name/email to the mobile account menu using `DropdownMenuLabel` and truncate long identities; verify the mobile menu exposes identity at 390px.
- [x] 2.4 Add/update the shell copy keys in `app/lib/i18n/en.ts` and verify no public header references lock/account strings.
- [x] 2.5 Update `e2e/auth.spec.ts` for the public header (no disabled lock, theme control visible) and add a current-nav assertion; verify the affected auth/a11y projects pass.

## 3. Shell composition

- [x] 3.1 Move the authenticated header above the 2FA/offline banners, keep the banners inert while locked, and use one aligned content width for header and main; verify navigation and banners do not overlap at 390/1440.
- [x] 3.2 Keep `AppShell` as the only frame and do not add `PageHeader`/`SectionNav` or route layouts; verify `git diff` contains no new route entries or page primitives.
- [x] 3.3 Verify public and authenticated shells keep one main landmark, no horizontal overflow at 360px, and no vault content in shell markup.

## 4. Locked overlay

- [x] 4.1 Replace the hand-rolled locked card with a controlled Radix Dialog (`showCloseButton={false}`, Escape and outside interaction blocked) while preserving the password form, error, and sign-out actions; verify `getByRole('dialog')` and password focus.
- [x] 4.2 Preserve focus trapping, return focus to the lock action after unlock, and keep protected children unmounted while locked; verify Tab cycling, Escape staying open, and unlock focus with E2E.
- [x] 4.3 Show a visible signing-out state and delay the fifth-attempt sign-out long enough for the lockout message to render; verify `/login` still appears within the E2E timeout and the message is observable.

## 5. Integration

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and the full E2E suite; verify no new dependency, server/API change, or secret in shell/screenshots.
- [x] 5.2 Capture 390 and 1440 screenshots for public header, authenticated header, mobile menu, and locked overlay; verify no vault plaintext, ciphertext, token, or real email appears.
- [x] 5.3 Run `openspec validate ux-foundation-shell --strict` and verify all tasks are complete before review.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge and a green gate.
- Re-run `openspec validate --all --strict` after archive.
