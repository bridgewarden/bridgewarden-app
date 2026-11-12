# Web security notes

## Content Security Policy

Document responses use a per-request nonce generated in the Worker and passed to React Router's
`ServerRouter`, `Scripts`, and inline hydration/streaming scripts. `script-src` never contains
`unsafe-inline`; development additionally allows Vite's injected styles and websocket connection.

Generated Radix and sonner primitives set inline `style` attributes for positioning and CSS
variables. Those attributes cannot receive a nonce, so the policy keeps the smallest possible
exception:

```text
style-src-attr 'unsafe-inline'
```

Sonner injects its stylesheet as a `<style>` element at module load. Production CSP allows that
exact payload with a SHA-256 hash (`style-src-elem`); `scripts/check-sonner-csp-hash.ts` fails the
build when the installed Sonner stylesheet changes. Scripts remain nonce-only. `style-src` stays
`'self'` in production; only the development policy adds `'unsafe-inline'` for Vite style injection.

The manifest and `theme-color` metadata are static PWA metadata; the document value comes from
`PWA_THEME_COLOR` in `app/lib/theme.ts`.

## Headers and cookies

The Worker applies `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`, and framing protection to all
responses. HSTS is emitted only for HTTPS production responses. Authenticated HTML and API
responses are `Cache-Control: no-store`. The session cookie remains `HttpOnly; Secure;
SameSite=Lax; Path=/`.

## Service worker

The generated service worker precaches versioned static assets and the unauthenticated `/offline`
app shell. It never caches `/api/*`, `/auth/*`, `/setup`, authenticated HTML, or vault data. Vault
content is read only from IndexedDB. Offline navigations redirect to `/offline`, which boots the
app shell and shows the locked state. A waiting worker is activated only when the user accepts the
update prompt.

## Local preview exception

`pnpm preview` copies `.dev.vars` into `build/server` for the lifetime of the local Vite preview
process and removes it on exit. `pnpm test:e2e` also removes any leftover preview secret after
Playwright finishes. `pnpm build` and `pnpm deploy` run `strip-build-secrets` and never write
secrets into deployable output.

## PWA metadata

`public/manifest.webmanifest` is static install metadata. Its `theme_color`/`background_color`
are the only raw color values outside `app/app.css`; the document theme color is read from
`PWA_THEME_COLOR` in `app/lib/theme.ts`.
