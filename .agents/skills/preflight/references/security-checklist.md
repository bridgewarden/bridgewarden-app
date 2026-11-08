# Security checklist — Bridgewarden preflight lens

Project threat model and controls: `.agent/prd/PRD.md` §10. Zero-knowledge is the product,
not a feature: the server must never be able to read vault content, and the browser must never
leak it.

## 1. Zero-knowledge invariants

- No plaintext vault field (name, username, password, URL, notes, custom fields, item TOTP
  secret, folder name) is sent to the server, written to a log, embedded in SSR HTML, or
  persisted outside the encrypted envelope.
- Server code contains no decrypt path for `vault_items.data_ct` or `folders.name_ct`.
- `vaultKey` is never serialized to JSON, React state, localStorage, sessionStorage,
  IndexedDB plaintext, URL, or logs.
- `masterKey`, the master password, and the recovery secret never leave the browser.
- `authHash` is one-way: the server stores only `HMAC(AUTH_PEPPER, authHash || serverSalt)`.
- The only deliberate server-decryptable secret is the 2FA TOTP seed (`TOTP_ENC_KEY`), and it
  must be documented as such.

## 2. Crypto misuse

- PBKDF2-SHA256 at the stored iteration count (default 600000); iterations come from the user
  row, not a hardcoded client constant after setup.
- HKDF info strings stay exactly `bw-auth`, `bw-wrap`, `bw-recovery`, `bw-totp`; changing one
  breaks every stored vault.
- Fresh random 96-bit IV for every AES-256-GCM encryption. No deterministic IV, no counter
  reuse across saves, no IV derived from the item id.
- Unknown envelope `v` or `alg` is rejected with a typed error; never fall back to plaintext
  or to a "try anyway" path.
- Base64 parsing is strict; malformed input fails closed.
- Password normalization (NFKC) matches the documented contract; changing it is a breaking
  change that needs a migration story.
- No `Math.random()` anywhere in key, IV, recovery-key, backup-code, or password generation.
- Google Passkey/WebAuthn additions must not silently weaken the master-password path.

## 3. Key handling and memory

- Unlock derives and unwraps client-side; no server round trip is required to unlock.
- `lock()` clears the vault key reference and any decrypted cache; the encrypted IndexedDB
  cache and wrapped keys may remain.
- Five failed local unlock attempts force logout and session revocation.
- Secret fields are not rendered in SSR output and carry `autocomplete="off"` and
  `spellcheck="false"`.
- Reveal state auto-hides; clipboard auto-clear is best-effort and never claims a guarantee.

## 4. Authentication and sessions

- Login returns a generic 401 for both unknown email and wrong password.
- Auth-hash comparison is constant-time; input length is checked without leaking user
  existence through timing.
- Session token is random, stored only as `sha256(token)` in KV, delivered in an httpOnly,
  Secure, SameSite=Lax cookie with `Path=/`.
- Session revocation is authoritative through a `ver` value in D1, not only KV deletion.
- Disabled users are rejected by the guard for pages and APIs.
- Password change and recovery reset revoke other sessions.
- Setup is reachable only while the user table is empty, enforced by a single atomic
  `INSERT … SELECT … WHERE NOT EXISTS`.

## 5. 2FA

- The TOTP seed is encrypted at rest with `TOTP_ENC_KEY`; it is never returned after
  enrollment and never logged.
- Codes are verified with a ±1 step window; a step less than or equal to `last_totp_step` is
  rejected (replay).
- The challenge token is short-lived, single-use, and not authoritative for authorization.
- Backup codes are stored as HMACs, consumed by a conditional update (`WHERE used_at IS
  NULL`), and regenerated atomically.

## 6. Authorization

- `user_id` comes from the session only. No handler reads `user_id` from body, query, or
  header.
- Every item, folder, trash, and restore operation verifies ownership; foreign ids return
  404, never 403.
- Admin routes require `role === 'admin'`; the last active admin cannot be disabled or
  demoted.
- No route exposes another user's ciphertext, wrapped keys, or 2FA state.

## 7. Input, output, and browser surface

- Zod validation at every server boundary: enums, base64 validity, ciphertext ≤ 64KB,
  request body ≤ 256KB, page size ≤ 500.
- No `dangerouslySetInnerHTML`; no user-controlled URL rendered into `href`/`src` without an
  allowlist (block `javascript:`, `data:` except images where intended).
- The `next` redirect parameter is validated as a same-origin relative path.
- CSP is nonce-based; no `unsafe-inline` for scripts; no third-party scripts, fonts, or
  analytics.
- HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a restrictive
  `Permissions-Policy` are set.
- Mutating requests reject cross-origin `Origin`/`Host`; no GET mutates state.
- Authenticated HTML is `Cache-Control: no-store` and contains no ciphertext.

## 8. Secrets and configuration

- Secrets live only in `.dev.vars` locally and Worker secrets in production. Never in
  `wrangler.jsonc` vars, source, fixtures, tests, PR bodies, screenshots, or logs.
- `.env.local`, `.dev.vars`, `.wrangler/`, and build output are gitignored.
- No secret is imported into client code; check the built client bundle when in doubt.
- Rotating `AUTH_PEPPER` or `TOTP_ENC_KEY` is destructive and must be documented as such.

## 9. Abuse resistance

- Rate limiting covers `/auth/login`, `/auth/2fa`, `/auth/recover`, and `/setup`, keyed by
  hashed IP and hashed email.
- Account lockout after 10 consecutive failures with `Retry-After`.
- Failed setup attempts, 2FA failures, and lockouts emit audit events without payloads.
- Nothing lets an unauthenticated caller enumerate emails or distinguish lockout from wrong
  password in a way that reveals account existence.

## 10. Logging and audit

- Logs contain request id, method, route pattern, status, duration, and a hashed user id.
- Logs never contain email, password, auth hash, TOTP code, session token, recovery key,
  cookie values, request bodies, or ciphertext.
- Audit metadata holds counts and enum values only.
- Error responses are generic with a request id; stacks stay server-side.

## 11. Offline and local storage

- IndexedDB stores ciphertext and metadata only. Decrypted items live in memory for the
  lifetime of a view.
- Logout wipes all stores; account switch wipes before writing new keys.
- The service worker never caches `/api/*` or authenticated HTML.
- Private-mode IndexedDB failure degrades to online-only with a visible notice.

## 12. Dependencies and supply chain

- A new dependency needs a stated reason and no equivalent already in the stack.
- Prefer WebCrypto, platform APIs, and existing project utilities over new packages for
  crypto, OTP, base64, and clipboard.
- Do not add libraries that execute remote code, inject scripts, or phone home.

## Severity guide

| Severity | Meaning |
|----------|---------|
| CRITICAL | Vault plaintext or key material exposed, auth bypass, or crypto break |
| HIGH | Authorization bypass, replay, secret in logs/bundle, XSS with session impact |
| MEDIUM | Missing limit, weak generic error, cache header gap, defense-in-depth regression |
| LOW | Hardening nit with no demonstrated path |
