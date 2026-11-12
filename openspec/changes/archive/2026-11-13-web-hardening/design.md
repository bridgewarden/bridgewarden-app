# Design

## Context

See `proposal.md`. The app is SSR-only React Router v8 on Cloudflare Workers. Current document headers only set framing/referrer, there is no custom server entry, no axe/budget/PWA tooling, and React Router hydration scripts support an optional nonce.

The CSP nonce is the highest-risk item: it must cover React Router inline hydration scripts without enabling `script-src 'unsafe-inline'`. Radix/sonner use inline style attributes, which cannot receive a nonce; the narrowest documented style-attribute exception is required.

## Goals / Non-Goals

**Goals:**

- Per-request nonce CSP, hardening headers, CSRF audit, SSR privacy proof.
- Automated axe gate and keyboard-critical flow.
- Measured bundle/LCP budgets with CI enforcement.
- Installable manifest, versioned shell worker, offline boot, update prompt.

**Non-Goals:**

- New vault features, API schema changes, database migrations, audit suite/docs/deploy from TASK-19.
- Caching vault data or `/api/*` in the service worker.
- A full manual screen-reader certification beyond the listed surfaces.

## Decisions

### Nonce is generated in the Worker and threaded to React Router

The Worker generates a cryptographically random nonce per document request and stores it in a request-scoped security context. The root loader exposes it to the document Layout. `Scripts` receives the nonce so hydration scripts carry it. The Worker wraps document responses and emits the CSP with that nonce.

If the default React Router server entry does not apply the nonce to every required inline script, add the minimal custom `entry.server.tsx` and pass the nonce into `ServerRouter`. Validate early with a CSP violation test; do not fall back to `unsafe-inline` for scripts.

CSP baseline:

```text
default-src 'self';
script-src 'self' 'nonce-<per-request>';
style-src 'self';
style-src-elem 'self' 'sha256-<sonner-stylesheet>';
style-src-attr 'unsafe-inline';
img-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'none';
form-action 'self';
object-src 'none'
```

The `style-src-attr` exception covers generated Radix/sonner style attributes, and the `style-src-elem` hash covers Sonner's runtime-injected stylesheet. Both are documented in `docs/web-security.md`; `scripts/check-sonner-csp-hash.ts` fails the build when Sonner changes.

### Header policy is applied centrally

The Worker applies a shared security-header helper to every response:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` only for HTTPS production responses
- `Cache-Control: no-store` for authenticated HTML and API responses

CSP is added only to document responses; API responses still receive the other headers. HSTS is omitted on local HTTP so development and E2E remain usable.

### CSRF uses the existing origin contract

The existing mutation JSON/origin helpers remain the single CSRF mechanism. Audit every route: mutations use POST/PATCH/DELETE with Origin, loaders are read-only, and API handlers derive `user_id` from the session. Add tests for missing/foreign Origin and a GET mutation probe.

### SSR privacy is proven at the boundary

Add an integration test that seeds a vault and requests `/app` with a valid session. It asserts the HTML contains no ciphertext, decrypted item names, or vault item ids, and that the response is `no-store`. Vault routes stay client-loaded after unlock.

### Accessibility gate is automated first, then fixed

Add `@axe-core/playwright` and run scans on setup, login, 2FA, unlock, list, editor, and generator. Disable only rule categories that are genuinely inapplicable, with a reason; do not suppress critical/serious findings. Fix landmarks, heading order, labels, `aria-describedby`, focus trap/restore, live regions, and contrast.

Add a keyboard-only Playwright flow: setup → create item → lock → unlock, plus dialog close focus assertions.

### Performance is measured before budgets are enforced

Add a post-build report that gzip-measures entry/route chunks. Budgets:

- initial unauthenticated JS < 200KB gzip
- vault route chunk < 150KB gzip
- KDF unlock p95 < 1s
- LCP < 2.5s on throttled 4G

Use route-level dynamic imports for crypto and editor-heavy modules; remove unused UI primitives. The CI gate consumes the report and fails on overage. LCP is measured with Playwright CDP throttling or Lighthouse CI if available.

### PWA caches only the shell

Add a manifest and icons. A post-build script generates a versioned service worker precache list from hashed static assets. Navigation is network-first; offline redirects to the precached `/offline` app shell, which contains no user, vault, or API data. The shell client boots and shows the locked/offline state; vault content remains IndexedDB-only.

The worker never handles `/api/*` from cache. A `waiting` worker triggers an in-app update prompt; accepting it posts `skipWaiting`, waits for `controllerchange`, and reloads once.

## Risks / Trade-offs

- **Nonce does not cover every inline script** -> validate with CSP tests early; custom entry server is the fallback, never unsafe-inline.
- **Inline style attributes** -> documented `style-src-attr` exception; no style-src script relaxation.
- **HSTS in development** -> production HTTPS only.
- **Axe surfaces pre-existing debt** -> fix or narrowly suppress with rationale; critical/serious gate remains.
- **Bundle budgets fail immediately** -> measure/report first, dynamic-import crypto, remove unused primitives before enforcing.
- **PWA caches authenticated HTML** -> forbid; cache static assets and a userless offline shell only.
- **Service worker update loops** -> versioned cache and explicit user-triggered activation.

## Migration Plan

- Ship security headers/CSP before PWA; PWA cannot hide CSP errors.
- HSTS takes effect only on HTTPS production.
- Service worker cache version is bumped per build; old caches removed on activation.
- Rollback: disable worker registration and serve the normal SSR app; no data migration.

## Open Questions

None. The CSP style-attribute exception is documented and scripts remain nonce-only.
