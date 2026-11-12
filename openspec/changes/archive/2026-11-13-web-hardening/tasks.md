# Tasks

## 1. CSP and security headers

- [x] 1.1 Add a request-scoped nonce/security context in the Worker and expose it to the root document.
- [x] 1.2 Pass the nonce to React Router `Scripts`; add `entry.server.tsx` only if required, then verify every inline hydration script carries it.
- [x] 1.3 Emit the CSP from a shared header helper with `script-src 'self' 'nonce-…'`, no `unsafe-inline`, and the documented `style-src-attr` exception.
- [x] 1.4 Add HSTS (HTTPS production only), nosniff, no-referrer, Permissions-Policy, and no-store for authenticated HTML/API.
- [x] 1.5 Audit every mutation for Origin/method enforcement and confirm loaders do not mutate.
- [x] 1.6 Add header/CSP tests: unique nonce, no CSP console violation, cross-origin POST rejected, GET has no side effect.
- [x] 1.7 Add the seeded-vault SSR test asserting no ciphertext/item data and `Cache-Control: no-store`.

## 2. Accessibility

- [x] 2.1 Add `@axe-core/playwright` and a scan helper for setup, login, 2FA, unlock, list, editor, and generator.
- [x] 2.2 Fix landmarks, heading order, form labels, `aria-describedby`, and invalid-state associations.
- [x] 2.3 Fix dialog focus trap/restore and toast live-region announcements.
- [x] 2.4 Fix focus visibility and AA contrast in light and dark themes.
- [x] 2.5 Add a keyboard-only setup → create item → lock → unlock flow and dialog-close focus assertions.
- [x] 2.6 Gate CI on zero critical/serious axe violations; document any intentional exclusion.

## 3. Performance budgets

- [x] 3.1 Add a post-build gzip report for entry and route chunks.
- [x] 3.2 Dynamically import crypto on unlock/setup only and route-split editor-heavy modules.
- [x] 3.3 Remove unused shadcn primitives and confirm the vault chunk stays under 150KB gzip.
- [x] 3.4 Add the initial JS <200KB and vault <150KB budget gate to CI.
- [x] 3.5 Add unlock p95 and throttled-4G LCP (<2.5s) checks.
- [x] 3.6 Record before/after sizes and LCP numbers for the PR.

## 4. PWA shell

- [x] 4.1 Add a manifest with name, short_name, standalone display, theme color, `start_url` `/app`, and valid icons.
- [x] 4.2 Add a build step that generates a versioned service-worker precache list for hashed static assets.
- [x] 4.3 Implement network-first navigations, a userless offline shell fallback, and cache cleanup on activation.
- [x] 4.4 Guarantee `/api/*` and vault data are never cached; source vault content only from IndexedDB.
- [x] 4.5 Register the worker and add an update prompt on `waiting`, reloading once after user acceptance.
- [x] 4.6 Add Playwright coverage for installability, offline boot/locked shell, API cache bypass, and update prompt.

## 5. Verification

- [x] 5.1 `pnpm typecheck`, `pnpm lint`, `pnpm format:check`
- [x] 5.2 `pnpm test` and `pnpm test:e2e`
- [x] 5.3 `pnpm build` including budget report and service-worker generation
- [x] 5.4 `openspec validate web-hardening --strict`
