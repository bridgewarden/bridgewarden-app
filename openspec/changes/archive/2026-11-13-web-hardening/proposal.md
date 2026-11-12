# Proposal

## Why

The app is functionally complete but the deployed surface still lacks a script CSP and hardening headers, has no automated accessibility gate, no bundle/LCP budgets, and no installable offline shell. TASK-18 closes those production-readiness gaps without adding new vault features.

## What Changes

- Add a per-request nonce CSP covering scripts, styles, images, connections, framing, base URI, and form actions; no `script-src 'unsafe-inline'`.
- Add HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a restrictive Permissions-Policy.
- Audit CSRF on every mutation and verify no GET mutates state.
- Add axe-core Playwright checks on setup, login, 2FA, unlock, list, editor, and generator, plus a keyboard-only critical flow.
- Fix landmarks, headings, labels, error associations, focus trap/restore, contrast, and toast live regions.
- Add bundle-size and LCP budgets, route/crypto code-splitting, and a CI gate.
- Prove vault routes contain no ciphertext in SSR HTML and authenticated HTML is `no-store`.
- Add a web manifest, versioned service worker for the app shell, offline navigation fallback, and update prompt.
- Never cache `/api/*` or vault data in the service worker.

## Capabilities

### New Capabilities

- `web-security`: nonce CSP, hardening headers, CSRF/origin enforcement, and web security verification.
- `accessibility`: WCAG 2.1 AA behavior and automated axe/keyboard verification.
- `web-performance`: route/crypto splitting, bundle budgets, and LCP measurement.
- `offline-pwa`: installable manifest, versioned shell worker, offline boot, and update prompt.

### Modified Capabilities

None.

## Impact

- Custom server entry/nonce plumbing, root headers, and Worker response wrapping.
- Playwright configuration, axe/keyboard tests, build-budget script, CI.
- Dynamic imports for crypto/editor routes and removal of unused primitives.
- `public/manifest.webmanifest`, icons, service worker, and registration/update UI.
- No database migration or vault payload/API contract change.
- CSP style attributes from Radix/sonner use a documented `style-src-attr 'unsafe-inline'` exception plus a build-checked hash for Sonner's injected stylesheet; scripts must remain nonce-only.
