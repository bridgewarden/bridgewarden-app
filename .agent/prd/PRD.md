# Bridgewarden — Product Requirements Document

**Version:** 1.0 (MVP)
**Date:** 2026-11-05
**Owner:** alfian
**Status:** Draft for implementation
**Target surface:** Web application (this workspace). Browser extension and Android app are separate future workspaces that consume the same API contract and crypto format.

---

## 1. Overview, Objectives, Success Criteria

### 1.1 What we are building

Bridgewarden is a zero-knowledge password manager for personal and family use, deployed entirely on Cloudflare. One React Router v8 application serves both UI and API from a single Worker, with D1 for relational data, KV for sessions, and R2 reserved for phase 2 attachments.

The vault is encrypted and decrypted in the browser. The server stores ciphertext, an authentication hash the user's master password cannot be recovered from, and opaque session tokens. A full D1 dump does not expose any vault content.

### 1.2 Why

Existing self-hosted options (Vaultwarden, Bitwarden self-hosted) require a VPS, maintenance, and backups. Existing Cloudflare ports (Warden worker, NodeWarden, vaultwarden-worker) implement the Bitwarden wire protocol so official clients work, but ship no first-party UI and inherit protocol constraints. Bridgewarden is Cloudflare-native, has its own UI, and owns its crypto format so the web app, extension, and Android client can share one contract without emulating Bitwarden.

### 1.3 Objectives (MVP)

1. A single personal vault that works on desktop and mobile web, online and offline.
2. Zero-knowledge guarantees verifiable by reading the server code: no endpoint accepts or returns plaintext vault content.
3. Cheap to run: fits Cloudflare Workers free tier at family scale (<100k requests/month).
4. A crypto and API contract that a browser extension and Android client can reuse unchanged.

### 1.4 Success criteria

| # | Metric | Target |
|---|--------|--------|
| S1 | Vault content visible to server | Zero fields; only ciphertext + plaintext metadata (type, folder, timestamps, rev) |
| S2 | Unlock time (PBKDF2 600k, mid-range laptop) | < 1s p95 |
| S3 | Cold LCP on 4G | < 2.5s |
| S4 | Initial JS for unauthenticated routes | < 200KB gzip |
| S5 | Critical-flow E2E coverage | setup, login, 2FA, CRUD, lock/unlock, trash, password change |
| S6 | Accessibility | WCAG 2.1 AA on unlock, list, editor, generator flows |
| S7 | Offline | Vault readable and item edits queued-free (read-only offline is not enough; create/edit must persist to cache and sync on reconnect) |

### 1.5 Non-goals (MVP)

- Browser extension, autofill, Android/iOS apps.
- Organizations, family sharing, collections, sharing links, Send.
- File attachments, passkeys/WebAuthn login, SSO, SCIM.
- Import/export of external vault formats.
- Public registration, billing, email delivery, password reset by email.
- Server-side search (impossible by design with zero-knowledge).
- Audit/compliance exports, legal pages.

> Phase 2 roadmap is defined in §11. The schema is pre-seeded for organizations so phase 2 does not need a destructive migration.

---

## 2. Target Audience

| Persona | Need | MVP relevance |
|---------|------|---------------|
| Solo technical user | Own passwords without a VPS, no vendor lock-in | Primary |
| Couple / family (2–5 people) | Independent vaults now, shared collections later | Primary (shared collections = phase 2) |
| Privacy-conscious user | Verifiable zero-knowledge, no third-party JS | Secondary |

Assumed skill level: comfortable entering a master password and storing a recovery key. Not assumed: knowledge of cryptography or self-hosting.

---

## 3. Competitive Landscape and Differentiation

| Product | Deployment | UI | Crypto | Gap Bridgewarden targets |
|---------|-----------|----|--------|--------------------------|
| Bitwarden (cloud/self-host) | VPS or vendor | Mature | E2E | Heavy self-host stack, needs server ops |
| Vaultwarden | VPS (Rust) | Inherited Bitwarden clients | E2E | No first-party UI, VPS required |
| NodeWarden / Warden worker | Cloudflare Workers | None (Bitwarden clients) | E2E | Protocol emulation, no owned UI, no own contract |
| 1Password | Vendor cloud | Mature | E2E | Closed, subscription, not self-hosted |
| Proton Pass | Vendor cloud | Mature | E2E | Closed, vendor account required |

**Differentiators for MVP**

1. **Cloudflare-native, zero servers**: Worker + D1 + KV only; no VPS, no container, no cron VM.
2. **Owned UI**: React Router v8 full-stack app, not a protocol shim.
3. **Owned crypto contract**: versioned envelope format shared by web, extension, Android later.
4. **Verifiable zero-knowledge**: server code contains no decrypt path for vault content.
5. **Family-ready schema** without family-sharing complexity in MVP.

**Deliberate trade-off:** we do not aim for Bitwarden client compatibility. That is a feature of competitors, not a requirement here.

---

## 4. Core Features and Requirements

Requirement IDs are stable and become implementation task IDs. `TASK-1` is reserved for prerequisite verification.

### 4.1 Foundation

#### TASK-2 — Scaffold the React Router v8 + Cloudflare project
- Created with `npm create cloudflare@latest -- . --framework=react-router` (React Router v8, Cloudflare Vite plugin), SSR enabled.
- `wrangler.jsonc` declares `main: ./workers/app.ts`, static assets from `build/client`, `nodejs_compat`, and `observability.enabled: true`.
- `pnpm dev` runs the app in the Workers runtime; `pnpm build` and `pnpm deploy` work.
- Folder layout follows `AGENTS.md`: `app/routes` (transport only), `app/features/<feature>/` (page entries), `app/lib/.server/` (server infrastructure), `app/server/<domain>/` (shared domain logic), `app/components`, `app/__test__/`, `workers/app.ts`, `migrations/`.
- **Acceptance:** fresh clone + install + `pnpm dev` serves a page; `pnpm build` exits 0; no SPA-mode assumptions (plugin does not support SPA/prerender).

#### TASK-3 — Configure bindings, typed environment, and secrets
- Bindings: `DB` (D1), `KV_SESSIONS` (KV), `RATE_LIMITER` (Rate Limiting binding), `R2` (declared, unused in MVP).
- Secrets read from Worker secrets in production and `.dev.vars` locally: `SESSION_SECRET`, `AUTH_PEPPER`, `TOTP_ENC_KEY`, `BOOTSTRAP_TOKEN`, `APP_ORIGIN`, `TOTP_ISSUER`, `APP_ENV`.
- A single typed `Env` interface plus a helper that fails fast at request time if a required secret is missing.
- `.env.local` holds placeholder names only; `.dev.vars` mirrors it for Wrangler; both are gitignored.
- **Acceptance:** a loader can read `context.cloudflare.env.DB` and run `SELECT 1`; missing secret produces a 500 with a generic message (no secret names leaked to client); no secret appears in client bundle.

#### TASK-4 — Migration tooling and baseline schema
- `pnpm db:migrate:local` and `pnpm db:migrate:remote` wrap `wrangler d1 migrations apply`.
- Migrations are numbered and forward-only; each is idempotent-safe where practical.
- A reset script recreates the local database from migrations.
- **Acceptance:** `migrations/` applies cleanly to a fresh local D1; `wrangler d1 migrations list` shows all applied; reset script restores a working empty database.

#### TASK-5 — Design system, app shell, and i18n-ready copy
- Tailwind CSS + shadcn/ui primitives (button, input, dialog, dropdown, toast, tooltip, sheet).
- App shell: header with lock button, user menu, theme toggle (light/dark/system); content container; mobile bottom or drawer nav.
- All user-facing strings come from a single message catalog (English only, `en`), so a second locale can be added without touching components.
- No third-party scripts, fonts, or analytics.
- **Acceptance:** shell renders on all routes; theme persists; every visible string is referenced from the catalog; no inline `<style>`/`<script>` in components.

#### TASK-6 — Test harness
- Vitest (unit, Workers pool for server code) and Playwright (E2E against `pnpm dev`).
- Test fixtures create users and vault data without touching production code paths.
- **Acceptance:** `pnpm test` and `pnpm test:e2e` run in CI-like local mode; a failing assertion fails the command with non-zero exit.

#### TASK-57 — Repository initialization and conventions
- `git init` with an initial commit before any application code; `main` is the integration branch and all work lands through PRs.
- `.gitignore` covers `.env.local`, `.dev.vars`, `.wrangler/`, `build/`, `node_modules/`, and test artifacts.
- `.editorconfig` fixes charset UTF-8, LF endings, 2-space indent, and a final newline.
- Commit convention is Conventional Commits; PR titles follow `type(scope): summary`.
- **Acceptance:** `git status` is clean after the initial commit; a seeded `.env.local` and `.dev.vars` are ignored; a non-conforming commit message is documented as rejected in review.

#### TASK-58 — Agent context contract
- `AGENTS.md` at the repo root is the entry point for any AI agent working in this repository.
- It states the verify commands (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`), the architecture invariants (crypto is client-only, no vault plaintext on the server, no ciphertext in SSR HTML, secrets never leave `.dev.vars`), the file layout, and the rule that PRD requirement IDs are referenced in PR bodies.
- It must not duplicate the PRD; it links to `.agent/prd/PRD.md`, `.agent/prd/PR-PLAN.md`, and `.agent/tasks.json`.
- It lists the project-scoped skills in `.agents/skills/` and states that `/preflight` (gate + parallel reviewers including the security lens) runs before any PR is opened.
- **Acceptance:** a new agent can determine what to run before opening a PR without reading source files; `AGENTS.md` contains no secrets; commands listed match `package.json` scripts once PR 01 lands.

#### TASK-59 — Verify gates and CI
- `pnpm lint` (ESLint or Biome), `pnpm format:check` (Prettier), and `pnpm typecheck` (`tsc --noEmit`, strict) exist and pass on a clean checkout.
- A GitHub Actions workflow runs install, typecheck, lint, unit tests, and build on every pull request.
- `packageManager` is pinned in `package.json`; the Node version is pinned via `.nvmrc`.
- **Acceptance:** a deliberately introduced type error, lint error, or failing test makes the corresponding command and the CI workflow fail.

### 4.2 Data model

#### TASK-7 — `users` table
- Columns: `id` (TEXT PK, UUIDv7), `email` (TEXT UNIQUE NOT NULL, lowercased), `display_name` (TEXT), `auth_hash` (TEXT NOT NULL), `server_salt` (TEXT NOT NULL), `kdf_alg` (TEXT NOT NULL, `pbkdf2-sha256`), `kdf_iterations` (INTEGER NOT NULL), `kdf_salt` (TEXT NOT NULL), `vault_key_wrapped` (TEXT NOT NULL), `vault_key_wrap_iv` (TEXT NOT NULL), `recovery_key_wrapped` (TEXT), `recovery_key_wrap_iv` (TEXT), `role` (TEXT NOT NULL, `admin|member`), `status` (TEXT NOT NULL, `active|disabled`), `vault_rev` (INTEGER NOT NULL DEFAULT 0), `failed_login_count` (INTEGER NOT NULL DEFAULT 0), `locked_until` (INTEGER), `created_at`, `updated_at`.
- Index on `email`. No plaintext secrets beyond the derived auth hash.
- **Acceptance:** unique constraint rejects duplicate email (case-insensitive); `vault_rev` starts at 0; no column can hold plaintext vault data.

#### TASK-8 — `vault_items` table
- Columns: `id` (TEXT PK), `user_id` (TEXT NOT NULL FK), `org_id` (TEXT NULL, dormant), `folder_id` (TEXT NULL), `type` (TEXT NOT NULL, `login|note`), `favorite` (INTEGER NOT NULL DEFAULT 0), `data_ct` (TEXT NOT NULL), `data_iv` (TEXT NOT NULL), `data_version` (INTEGER NOT NULL), `rev` (INTEGER NOT NULL), `deleted_at` (INTEGER NULL), `created_at`, `updated_at`.
- Indexes: `(user_id, rev)`, `(user_id, deleted_at)`, `(user_id, folder_id)`, `(user_id, type)`.
- **Acceptance:** every row belongs to exactly one user; `data_ct` is base64 ciphertext; a trigger-free application rule guarantees `rev` increases per user.

#### TASK-9 — `folders` table
- Columns: `id`, `user_id`, `name_ct`, `name_iv`, `data_version`, `rev`, `created_at`, `updated_at`.
- Flat in MVP; no nesting (schema allows a future `parent_id` migration).
- **Acceptance:** folder names are ciphertext only; deleting a folder sets items' `folder_id` to NULL rather than deleting items.

#### TASK-10 — 2FA and recovery tables
- `user_2fa`: `user_id` (PK), `totp_secret_ct`, `totp_secret_iv`, `enabled` (INTEGER), `last_totp_step` (INTEGER), `created_at`, `updated_at`.
- `backup_codes`: `id`, `user_id`, `code_hash`, `used_at`, `created_at`.
- TOTP secret is encrypted with `TOTP_ENC_KEY` (server-side), because the server must verify codes before the vault key exists.
- **Acceptance:** TOTP secret is never returned by any API after enrollment; backup codes are stored as HMACs, never plaintext; `last_totp_step` prevents code replay.

#### TASK-11 — `audit_events` table
- Columns: `id`, `user_id` (NULL for anonymous events), `type` (TEXT), `ip_hash` (TEXT), `ua_hash` (TEXT), `metadata` (TEXT JSON, no secrets), `created_at`.
- Index on `(user_id, created_at)`.
- **Acceptance:** login success/failure, 2FA failure, password change, admin user creation, vault purge events are recorded; no email, password, ciphertext, or token appears in `metadata`.

#### TASK-12 — Dormant organization/collection schema
- Tables `orgs`, `org_members` (`role`: `owner|admin|member`), `collections`, `collection_items`.
- No API, no UI, no routes in MVP.
- **Acceptance:** migrations create the tables; no route references them; `vault_items.org_id` remains NULL for all MVP rows.

### 4.3 Cryptography (client-side, shared contract)

#### TASK-13 — Master key derivation and auth hash
- `masterKey = PBKDF2-SHA256(masterPassword, kdfSalt, kdfIterations=600000, 32 bytes)` using WebCrypto.
- `authHash = HKDF-SHA256(masterKey, info="bw-auth", 32 bytes)` — one-way; server cannot recover `masterKey` from it.
- Server stores `auth_hash = HMAC-SHA256(AUTH_PEPPER, authHash || serverSalt)`; verification uses constant-time comparison.
- All base64 uses URL-safe encoding without padding in transport, standard base64 in storage (documented in the contract).
- **Acceptance:** identical inputs produce identical keys; changing one master password character changes both `masterKey` and `authHash`; no plaintext master password leaves the browser or is retained after derivation.

#### TASK-14 — Vault key generation and wrapping
- `vaultKey` = 32 random bytes generated once per user at setup (CSPRNG).
- `wrapKey = HKDF-SHA256(masterKey, salt=wrapSalt, info="bw-wrap")`; `vaultKey` is wrapped with AES-256-GCM → `vault_key_wrapped` + `vault_key_wrap_iv`.
- Unwrap happens only in memory during unlock; `vaultKey` is never persisted in plaintext, never sent to the server, and never written to IndexedDB.
- **Acceptance:** wrong password fails unwrap with an authentication error (no partial success); changing the master password re-wraps the same `vaultKey` so existing items stay readable; wrapped key round-trips across page reloads.

#### TASK-15 — Versioned item envelope
- Plaintext item JSON: `{ v: 1, type, name, username?, password?, urls?, notes?, totp?, fields? }`.
- Envelope: `{ v: 1, alg: "A256GCM", iv, ct }`, serialized to the two DB columns (`data_ct`, `data_iv`) plus `data_version`.
- Fresh random 96-bit IV per encryption; a nonce must never repeat for the same key.
- Decryption rejects unknown `v` or `alg` with a specific error and no plaintext fallback.
- **Acceptance:** tampering with `data_ct` or `data_iv` fails decryption; envelope from `v:1` decrypts after a reload; unknown version surfaces a user-visible "unsupported item format" error.

#### TASK-16 — Vault recovery key
- 128-bit random recovery secret, displayed once as Crockford base32 (26 chars, grouped), never sent to the server.
- `recoveryWrapKey = HKDF-SHA256(recoverySecret, salt=recoverySalt, info="bw-recovery")`; wraps the same `vaultKey` into `recovery_key_wrapped`.
- User must confirm they stored it during setup (mandatory checkbox + type-back of 6 characters).
- **Acceptance:** recovery key unwraps the vault; a wrong recovery key fails cleanly; regenerating the recovery key rewraps `vaultKey` and invalidates the old display value.

#### TASK-17 — Crypto tests and unlock benchmark
- Unit tests cover known-answer vectors for PBKDF2/HKDF/AES-GCM, envelope round-trip, tamper rejection, and wrap/unwrap.
- A benchmark test asserts unlock derivation completes within budget on CI hardware.
- **Acceptance:** tests run in Vitest with WebCrypto available; a deliberate IV reuse or altered ciphertext fails a test; benchmark reports timing.

### 4.4 Account and authentication

#### TASK-18 — First-run setup wizard
- Available only when `SELECT COUNT(*) FROM users` is 0; the create statement is a single atomic `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM users)` so two concurrent requests cannot both create an admin.
- Requires `BOOTSTRAP_TOKEN` in the form; invalid/missing token returns 403.
- Wizard steps: bootstrap token → email + display name → master password (strength meter, min 12 chars) → recovery key display + confirmation → 2FA enrollment (skippable with warning) → done.
- **Acceptance:** second request after the first admin exists returns 409 and no row is created; token is not persisted in a cookie or returned in a response; a browser refresh mid-wizard does not create a partial user.

#### TASK-19 — Login: password step and session issuance
- `POST /auth/login`: email + client `authHash`; server verifies with pepper constant-time compare; on success sets `bw_session` cookie (httpOnly, Secure, SameSite=Lax, Path=/, 30 days).
- Session token is 32 random bytes; KV stores only `sha256(token)` → `{userId, createdAt, lastSeenAt, uaHash, ipHash}`.
- Responses never distinguish "unknown email" from "wrong password" (generic 401) and never log the body.
- **Acceptance:** wrong password yields generic 401; successful login returns only post-auth state needed for the next step (2FA required? unwrap params: `kdfSalt`, `kdfIterations`, `wrappedVaultKey`); cookie is not readable by JavaScript.

#### TASK-20 — Session guard, logout, and revocation
- A server helper resolves the session for loaders/actions; unauthenticated access to `/app/*` redirects to `/login`.
- `POST /auth/logout` deletes the KV key, clears the cookie, and emits an audit event.
- Admin can revoke all sessions for a user (`session version` bump or KV prefix delete); password change revokes all other sessions.
- **Acceptance:** cookie deletion blocks subsequent `/app` requests; revoked session cannot be reused even with the old cookie; logout is idempotent.

#### TASK-21 — TOTP enrollment
- Generate a 160-bit secret, encrypt with `TOTP_ENC_KEY` before storage, show `otpauth://` URI and QR code rendered client-side (no external QR service).
- Require a valid 6-digit code before `enabled = 1`.
- **Acceptance:** secret never appears in a response after enrollment; invalid code leaves 2FA disabled; QR matches the URI; enrollment emits an audit event.

#### TASK-22 — TOTP challenge at login with replay protection
- If `enabled`, login returns `{ requires2fa: true }` and no session; `POST /auth/2fa` accepts a code with a `challengeToken` (short-lived, 5 min, KV) and issues the session.
- Accept ±1 time step (30s) window; reject any step <= `last_totp_step`; persist the accepted step.
- **Acceptance:** reused code fails; code from 2 steps ago fails; 5 failed attempts invalidate the challenge; audit event on failure.

#### TASK-23 — Backup codes for 2FA
- Generate 10 codes (10 chars, unambiguous alphabet), store HMAC-SHA256 with `AUTH_PEPPER`, display once, allow single use, allow regeneration (invalidates all).
- Accepted at `/auth/2fa` in place of a TOTP code.
- **Acceptance:** a code works once and only once; used code is rejected; regeneration invalidates old codes; only hashes are stored.

#### TASK-24 — Rate limiting and account lockout
- Rate limiting binding: per IP hash and per email on `/auth/login`, `/auth/2fa`, `/auth/recover`, `/setup`.
- Account lockout after 10 consecutive failures: `locked_until = now + 15 min`; successful login resets counters.
- **Acceptance:** 11th attempt within the window returns 429 (or 423 when locked) with `Retry-After`; a different account from the same IP is not blocked by one account's lockout beyond the shared IP budget.

#### TASK-25 — Admin user management
- Admin-only routes: list users, create user (email, display name, role), disable/enable user, revoke sessions.
- No email delivery: creating a user produces a one-time, 24-hour setup link/token the admin copies manually. New user sets their own master password and recovery key; the admin never sees it.
- **Acceptance:** non-admin gets 403; disabled user cannot log in and existing sessions are revoked; setup token is single-use and expires; admin cannot disable the last active admin.

#### TASK-26 — Change master password
- Requires current master password. Client re-derives `masterKey`, unwraps `vaultKey`, derives new `masterKey'` and `authHash'`, re-wraps `vaultKey`, then sends `{ authHash', kdfSalt', wrappedKey', wrapIv' }`.
- Server updates the hash and wrapped key atomically; other sessions are revoked; current session stays valid.
- Items are not re-encrypted (same `vaultKey`), so the operation is O(1).
- **Acceptance:** old password stops working; new password unlocks existing items; recovery key still unwraps the vault; failure mid-operation leaves the account on the old password.

#### TASK-27 — Vault recovery reset flow
- `/recover`: email + recovery key → client unwraps `vaultKey` → forces a new master password (re-wrap + new `authHash`) → revokes all sessions.
- Recovery key is re-generated on success because it is treated as burned.
- **Acceptance:** wrong recovery key shows a generic failure; successful reset logs the user in; old recovery key fails afterwards; audit event recorded.

#### TASK-28 — Auto-lock and re-unlock
- Configurable idle timeout (default 15 min; options 1/5/15/30/60/never). Timer resets on user interaction; a lock overlay covers the UI.
- Lock discards `vaultKey` and decrypted item state from memory, keeps the encrypted cache, keeps the session.
- Unlock re-derives `masterKey` locally from the entered password and unwraps the cached `vaultKey` (no server round trip); 5 wrong attempts force full logout.
- Locking on tab hide is configurable and off by default; locking on `visibilitychange` is on for the manual lock button.
- **Acceptance:** overlay appears at timeout; DevTools cannot find `vaultKey` after lock; unlock works offline; wrong password 5 times logs out.

### 4.5 Vault API

#### TASK-29 — List and incremental sync
- `GET /api/vault?since=<rev>` returns items and folders with `rev > since`, including tombstones (`deleted_at`, `rev`), plus `serverRev`.
- Ciphertext only; no decryption server-side; hard cap 500 rows per page with `nextCursor`.
- **Acceptance:** initial call with `since=0` returns all live items; second call with the latest `serverRev` returns an empty delta; deleted items appear as tombstones; response contains no plaintext names.

#### TASK-30 — Create item
- `POST /api/vault/items` accepts `{type, folder_id?, favorite, dataCt, dataIv, dataVersion}` and returns the created row with `rev`.
- Validates `type` enum, base64 sizes (ct ≤ 64KB), and folder ownership; assigns `rev = ++users.vault_rev` inside a D1 batch.
- **Acceptance:** invalid type/folder returns 400/403; new item gets a strictly increasing `rev`; another user cannot create an item for a folder they do not own.

#### TASK-31 — Update item with optimistic concurrency
- `PATCH /api/vault/items/:id` requires the client's `rev`; mismatch returns 409 with the current server row.
- Updating bumps `rev` and `updated_at`.
- **Acceptance:** stale `rev` returns 409 and does not overwrite; successful update is visible on the next sync; unknown id returns 404 without leaking existence across users.

#### TASK-32 — Trash, restore, purge
- `DELETE` soft-deletes (`deleted_at`, new `rev`); restore clears it; purge is permanent and requires an explicit confirmation token.
- Cron (daily) purges items deleted more than 30 days ago.
- **Acceptance:** trashed items disappear from the default list but appear in trash; restore returns them; purge is idempotent; cron job purges only expired rows.

#### TASK-33 — Folders API
- `GET/POST/PATCH/DELETE /api/folders` with ciphertext names, `rev` conflict handling, and the same ownership rules.
- Delete sets `folder_id = NULL` for contained items and bumps their `rev`.
- **Acceptance:** duplicate folder names allowed (client-side concern); cross-user folder access returns 404; folder deletion does not delete items.

#### TASK-34 — Per-user authorization and isolation
- Every API handler scopes queries by `user_id` from the session, never from request input.
- Item/folder IDs are validated as owned before mutation; failures return 404 (not 403) to avoid existence leaks.
- **Acceptance:** automated test attempts cross-user read/update/delete on items and folders and gets 404; no handler accepts `user_id` from the client.

#### TASK-35 — Payload validation and limits
- Validate with a schema library at the boundary: base64 validity, max sizes (ct 64KB, iv 32B, name fields inside ciphertext), max 500 items per page, max request body 256KB.
- Reject unknown top-level fields; log validation failures without payload contents.
- **Acceptance:** oversize body returns 413; malformed base64 returns 400; no raw payload is written to logs.

### 4.6 Vault client

#### TASK-36 — Encrypted local cache and sync engine
- IndexedDB stores: `items` (ct + metadata), `folders`, `wrappedKeys` (wrapped vault key, kdf params, salts), `syncState` (`serverRev`), `outbox` (pending mutations).
- On unlock: render from cache, then fetch deltas; mutations apply optimistically to cache and outbox, flush in order when online, reconcile on 409.
- Logout/account switch wipes all stores.
- **Acceptance:** reload preserves vault without a network request; offline create survives reload and syncs on reconnect exactly once; 409 triggers a refetch and a visible conflict notice.

#### TASK-37 — Unlock and key-lifetime provider
- A client context owns `vaultKey` in a module-scoped variable, never React state/localStorage/IndexedDB plaintext.
- `lock()` zeroes references, drops decrypted item cache, cancels timers; `unlock()` requires the master password.
- **Acceptance:** key is absent from localStorage/sessionStorage/IndexedDB plaintext; navigating between vault routes does not re-prompt; lock button works from any vault route.

#### TASK-38 — Vault list UI
- List rows show decrypted name, username (if login), folder, favorite, type; sort by name/updated; filter by type/folder/favorite.
- Keyboard: `j/k` or arrow navigation, Enter to open, `Ctrl/Cmd+K` opens search.
- **Acceptance:** list renders 500 items without jank; filters combine; empty list shows a CTA to create the first item; every action is reachable by keyboard.

#### TASK-39 — Client-side search
- Search matches decrypted name, username, URL, and notes substring; debounced; highlights matches.
- Search runs only in memory over decrypted items; no server call.
- **Acceptance:** search works offline; no query string is sent to the server; results update within 100ms for 1000 items.

#### TASK-40 — Login item editor
- Fields: name, username, password, URLs (multiple), notes, folder, favorite, TOTP secret, custom fields (key/value, hidden toggle).
- Password field: reveal, copy, generate; validation for required name.
- **Acceptance:** create/edit/delete round-trips to the server; unsaved changes trigger a confirm dialog on navigation; the stored item is ciphertext in D1 (verified by querying D1).

#### TASK-41 — Secure note editor
- Fields: name, body (multiline), folder, favorite.
- **Acceptance:** note body of 50KB encrypts, saves, and reloads correctly; oversized body is blocked client-side with a clear message.

#### TASK-42 — Password generator
- Length 8–64, character sets (upper/lower/digits/symbols), exclude ambiguous, passphrase mode (word count 3–6), strength indicator, copy button.
- Generation uses `crypto.getRandomValues`, never `Math.random`.
- **Acceptance:** toggling all sets off is prevented; generated passwords satisfy the selected policy; generator is reachable from the editor and standalone.

#### TASK-43 — TOTP generator for items
- RFC 6238 (SHA-1, 6 digits, 30s), countdown ring, copy-on-click, tolerance ±1 step for display stability.
- Secret parsing accepts `otpauth://` URI or base32; invalid secret shows an inline error.
- **Acceptance:** generated codes match a reference implementation (test vector); countdown resets correctly; code stays inside the encrypted envelope and is never sent to the server.

#### TASK-44 — Clipboard and reveal
- Copy actions show a toast and clear the clipboard after 30s only if the clipboard still holds our value where the browser allows verification; otherwise show a manual-clear hint.
- Password reveal auto-hides after 30s and on route change.
- **Acceptance:** copy works with keyboard and mouse; clear timer cancels on new copy; reveal state resets on lock.

#### TASK-45 — Trash UI
- Trash route lists soft-deleted items with deleted date; restore and purge (with confirmation) actions.
- **Acceptance:** purge requires typing the item name or a confirm dialog; restored item returns to its folder; trash is excluded from search.

#### TASK-46 — Empty, loading, and error states
- Skeletons for list/detail, empty states per surface, inline form errors, global toast for server failures, offline banner.
- Errors never render raw server messages or stack traces.
- **Acceptance:** simulated 500 shows a generic message plus retry; offline banner appears on network loss; no unhandled promise rejection in console during E2E.

#### TASK-47 — Responsive and mobile web
- Layouts at 360px, 768px, 1024px+; touch targets ≥ 44px; editor becomes full-screen sheet on mobile.
- **Acceptance:** core flows usable at 360px without horizontal scroll; Playwright viewport tests pass for login, list, editor, generator.

### 4.7 Security, quality, and operations

#### TASK-48 — Security headers, cookies, CSP, CSRF
- Nonce-based CSP: `default-src 'self'; script-src 'self' 'nonce-<per-request>'; style-src 'self' 'nonce-...'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`.
- React Router's inline hydration scripts must receive the nonce in `entry.server.tsx`; verify no `unsafe-inline` is needed. If a nonce cannot cover a required inline script, document the smallest possible exception.
- Headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` denying camera/mic/geo.
- CSRF: SameSite=Lax cookie plus Origin/Host check on every mutating request; no state-changing GET.
- **Acceptance:** CSP header present and scripts execute without console violations; cross-origin POST is rejected; cookie has `HttpOnly; Secure; SameSite=Lax`.

#### TASK-49 — Accessibility WCAG 2.1 AA
- Full keyboard operation, visible focus, 4.5:1 contrast, labelled inputs, error text associated via `aria-describedby`, dialog focus trapping and restore, live regions for toasts.
- Screen-reader pass on: setup, login, 2FA, unlock overlay, item list, editor, generator.
- **Acceptance:** axe-core reports zero critical/serious violations on those routes; manual keyboard-only run completes setup → create item → lock → unlock; focus is never trapped after closing a dialog.

#### TASK-50 — Performance budgets
- Route-level code splitting; crypto module loaded only on unlock/setup routes; no crypto in the initial bundle.
- Budgets enforced in CI: initial JS < 200KB gzip; vault route chunk < 150KB gzip; unlock < 1s p95 on a mid-range machine.
- **Acceptance:** build report shows budgets; LCP < 2.5s on throttled 4G in Lighthouse; no ciphertext embedded in SSR HTML responses.

#### TASK-51 — PWA shell and offline
- Web app manifest (name, icons, theme color, standalone), service worker caching app shell + static assets with versioned cache and update prompt.
- API and vault data are never served from the SW cache; they come from IndexedDB.
- **Acceptance:** app installs; reload offline shows the shell and the last unlocked-session state (locked overlay if key was discarded); update prompt appears on new deploy.

#### TASK-52 — Audit event emission
- Emit events for: bootstrap created, login success/failure, 2FA success/failure, backup code used, password changed, recovery used, user created/disabled, session revoked, item purged.
- **Acceptance:** each event row exists after the corresponding E2E action; metadata contains no email, token, ciphertext, or password.

#### TASK-53 — E2E test suite
- Playwright covers: first-run setup, login + 2FA, create/edit/delete login item, folder CRUD, search, generator, lock/unlock, trash restore/purge, change password, recovery reset, offline create-then-sync.
- **Acceptance:** suite passes headless against local D1; failures include a screenshot and trace; suite runs under 5 minutes.

#### TASK-54 — Observability and no-plaintext logging
- Workers Logs enabled; structured logs contain request id, route, status, duration, user id hash only.
- Global error handler returns a generic 500 with a request id and logs the stack server-side.
- **Acceptance:** grep of captured logs during E2E finds no email, password, authHash, TOTP code, or ciphertext; request id appears in both the response and the log.

#### TASK-55 — Documentation and runbooks
- `README.md`: local setup, migrations, deploy, environment variables, first-run bootstrap.
- `docs/threat-model.md`: assets, trust boundaries, attacker capabilities, explicit non-guarantees (JS memory, compromised client, lost recovery key).
- `docs/runbook.md`: D1 Time Travel restore, secret rotation impact (`AUTH_PEPPER`, `TOTP_ENC_KEY` are destructive), backup cadence, incident steps.
- **Acceptance:** a new developer can go from clone to deployed instance using only the README; threat model lists every server-visible field; rotation consequences are documented.

#### TASK-56 — Deploy and production smoke checklist
- Deploy to `*.workers.dev`; apply remote migrations; set Worker secrets; run the smoke checklist in production (setup guard, login, 2FA, CRUD, lock, recovery).
- **Acceptance:** production URL serves the app over HTTPS; `BOOTSTRAP_TOKEN` works only while the user table is empty (then 409); all smoke steps pass; D1 remote contains ciphertext only.

---

## 5. Key User Flows

### 5.1 First-run setup (empty instance)
1. Visitor opens `/setup`; app checks user count server-side.
2. Enters `BOOTSTRAP_TOKEN`, email, display name.
3. Enters master password (strength meter, min 12 chars); client derives `masterKey`, generates `vaultKey`, wraps it, derives `authHash`.
4. Client displays recovery key; user confirms storage.
5. Optional TOTP enrollment with QR; backup codes shown once.
6. Redirect to `/app`; vault unlocked.

Failure paths: wrong bootstrap token (403, no user); refresh mid-wizard (no partial user, restart); user count > 0 (409, redirect to login).

### 5.2 Daily login
1. `/login` → email + master password.
2. Client derives `authHash` locally; posts email + `authHash`.
3. Server verifies pepper+hash, returns unwrap params or a 2FA challenge.
4. If 2FA: code (or backup code) + challenge token → session.
5. Client unwraps `vaultKey`, loads cache, syncs deltas, renders list.

Failure paths: generic 401; lockout 423 with `Retry-After`; 2FA replay rejected.

### 5.3 Create and use an item
1. List → "New item" → choose Login or Note.
2. Fill fields; generate a password; optionally add TOTP secret.
3. Save: encrypt → optimistic cache write → outbox → POST → `rev` assigned.
4. Open item: copy username/password (auto-clear), generate TOTP code, edit, or trash.

### 5.4 Lock and unlock
1. Idle 15 min (or manual lock) → overlay; `vaultKey` discarded.
2. Enter master password → derive + unwrap locally from cached wrapped key → list returns immediately from cache.
3. Five wrong attempts → full logout and session revocation.

### 5.5 Change master password / recovery
1. Settings → Change password → current password + new password.
2. Client re-wraps `vaultKey`; server updates hash; other sessions revoked.
3. Lost password: `/recover` with recovery key → unwrap → set new password → new recovery key issued.

### 5.6 Offline
1. Vault already unlocked once → ciphertext cached.
2. Network drops → offline banner; reads work; creates/edits persist to cache + outbox.
3. Reconnect → outbox flushes in order; 409 conflicts surface a notice with reload option.

---

## 6. Technical Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | React Router v8, framework mode, SSR | `npm create cloudflare@latest -- . --framework=react-router`; Cloudflare Vite plugin; SPA/prerender unsupported |
| Runtime | Cloudflare Workers | Single Worker serves UI + API via `workers/app.ts` |
| Language | TypeScript strict | Shared types between routes and client modules |
| Database | D1 (SQLite) | Single-threaded per DB; use `batch()` for atomic multi-statement writes |
| Sessions | KV (`KV_SESSIONS`) | Opaque token hash → session JSON; eventual consistency acceptable |
| Rate limiting | Workers Rate Limiting binding | Per-IP and per-email counters at the edge |
| Object storage | R2 (declared, unused) | Reserved for phase 2 attachments |
| Styling/UI | Tailwind CSS + shadcn/ui | No third-party scripts/fonts |
| Forms/validation | React Router actions + Zod | Validation at server boundary |
| Crypto | WebCrypto | PBKDF2-SHA256 600k, HKDF-SHA256, AES-256-GCM; no WASM |
| Testing | Vitest + Playwright | Workers pool for server code |
| Package manager | pnpm | Already available locally (12.4.2) |
| Node | 24.x | Matches local toolchain (v24.21.0) |
| Wrangler | 4.x | Local 4.158.0 |
| CI | GitHub Actions (optional) | Typecheck, test, budget check |

**Architectural constraint (important):** Vault routes use `clientLoader`/client-side fetching after unlock. SSR loaders must return only session/user metadata, never ciphertext, so ciphertext is not embedded in HTML, cached by intermediaries, or logged.

---

## 7. Prerequisites and Access

### 7.1 Accounts and access

| Item | Status | Notes |
|------|--------|-------|
| Cloudflare account | Required, unverified | Must own the account that will host the Worker; free tier acceptable |
| Wrangler authenticated | Required, unverified | `wrangler whoami` must show the target account |
| D1 database | To be created | `wrangler d1 create bridgewarden-db`; Free tier 500MB DB limit is sufficient |
| KV namespaces | To be created | `KV_SESSIONS`, and rate-limit counters via binding rather than KV where possible |
| R2 bucket | Deferred | Not used in MVP |
| Custom domain | Not required | `*.workers.dev` for MVP |
| Email provider | Not required | No email flows in MVP by design |
| MCP servers | Not required | No MCP dependency for this project |
| Test users | Created by app | First admin via bootstrap; additional users via admin panel |

### 7.2 Documentation links

- React Router on Cloudflare: https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Workers Rate Limiting binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- WebCrypto PBKDF2: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey
- RFC 6238 (TOTP): https://datatracker.ietf.org/doc/html/rfc6238
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### 7.3 Environment variables

Written to `PROJECT_ROOT/.env.local` with placeholders; mirror into `.dev.vars` for Wrangler. Real values are filled manually by the owner.

| Name | Purpose | Type |
|------|---------|------|
| `SESSION_SECRET` | Cookie/token integrity helper | Secret |
| `AUTH_PEPPER` | HMAC pepper for stored auth hash and backup codes | Secret (destructive to rotate) |
| `TOTP_ENC_KEY` | AES-256-GCM key encrypting 2FA seeds at rest | Secret (destructive to rotate) |
| `BOOTSTRAP_TOKEN` | Gates first-admin creation | Secret |
| `APP_ORIGIN` | Cookie domain, redirects, TOTP issuer fallback | Config |
| `TOTP_ISSUER` | Label in authenticator apps | Config |
| `APP_ENV` | `development` / `production` | Config |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 id for `wrangler.jsonc` | Config |
| `CLOUDFLARE_KV_SESSIONS_ID` | KV namespace id | Config |
| `CLOUDFLARE_KV_RATE_LIMIT_ID` | KV namespace id (if used) | Config |
| `CLOUDFLARE_R2_BUCKET_NAME` | Reserved for phase 2 | Config |
| `CLOUDFLARE_ACCOUNT_ID` | Account id | Config |

**Rule:** no real secret value is written to this PRD, task files, logs, or chat.

### 7.4 Login/test users

- **First admin:** created through `/setup` using `BOOTSTRAP_TOKEN` while the user table is empty.
- **Test member:** created by the admin panel; the admin copies a one-time setup link and the member sets their own master password.
- No passwords or recovery keys are stored in this repository or documented here.

### 7.5 Open prerequisite gaps and decisions

| Gap | Decision |
|-----|----------|
| Cloudflare account/wrangler auth not yet verified in this session | Proceed; verified in `TASK-1` before feature work |
| D1/KV resource ids not yet created | Proceed; creation is part of `TASK-1`/`TASK-3` |
| No email provider | Accepted; no email flows in MVP |
| Free-tier D1 500MB cap | Accepted for personal/family scale |
| Custom domain absent | Accepted; `workers.dev` may complicate WebAuthn in phase 2, not MVP |

---

## 8. Conceptual Data Model

```
users
  id ──┬── vault_items.user_id
       ├── folders.user_id
       ├── user_2fa.user_id
       ├── backup_codes.user_id
       ├── audit_events.user_id
       └── sessions (KV: {userId,...})

folders (id, user_id, name_ct, name_iv, rev)
  └── vault_items.folder_id  (SET NULL on delete)

vault_items
  id, user_id, org_id(NULL), folder_id(NULL), type, favorite,
  data_ct, data_iv, data_version, rev, deleted_at, timestamps

user_2fa (user_id PK, totp_secret_ct, totp_secret_iv, enabled, last_totp_step)
backup_codes (id, user_id, code_hash, used_at)

-- dormant (phase 2)
orgs, org_members, collections, collection_items
```

**Encryption boundaries**
- Never encrypted (needed for sync/filtering): ids, user_id, folder_id, type, favorite, rev, timestamps, `deleted_at`, `org_id`.
- Always encrypted (client-side): item name, username, password, URLs, notes, custom fields, TOTP item secret, folder name.
- Server-side encrypted: 2FA TOTP seed (`TOTP_ENC_KEY`).
- Server-side derived one-way: `auth_hash`, `code_hash`.

**Sync model:** per-user monotonic `vault_rev`. Each mutation increments it and stamps the row. Clients pull `rev > since` including tombstones; conflicts resolved by explicit 409, never last-write-wins silently.

---

## 9. UI Design Principles

1. **One job per screen.** List → item → editor; no modal chains deeper than two.
2. **Lock-first.** Lock control always visible; overlay is unmistakable and keyboard-dismissable only with a password.
3. **No plaintext leakage in UI polish.** No autofill on vault fields, no `value` attributes in SSR HTML for secret fields, no clipboard history hints.
4. **Quiet, dense list.** Row = name, secondary line (username or note snippet), folder chip, favorite star. No decorative icons competing with text.
5. **Immediate feedback.** Optimistic save with a subtle "saved" indicator; conflicts surfaced as a blocking notice, not a silent overwrite.
6. **Mobile parity.** Full CRUD and generator on 360px; editor becomes a full-screen sheet.
7. **Accessible by default.** Visible focus ring, 44px targets, `aria-describedby` for errors, live region announcements for copy/save.
8. **Theme.** Light, dark, system. No color-only status signals.
9. **Copy.** English only, catalog-backed, i18n-ready; no jargon like "ciphertext" in user-facing text.
10. **Empty states teach.** "No items yet — create your first login" with a primary action.

**Wireframes:** none provided. Layout assumptions are listed above and should be validated against TASK-38/40/41 acceptance criteria.

---

## 10. Security Considerations

### 10.1 Threat model (summary)
- **Protected:** vault contents, master password, vault key, recovery key, 2FA seed.
- **Trusted:** the user's browser at the moment of use; Cloudflare's platform for availability and at-rest disk encryption.
- **Untrusted:** the server operator (by design), network, other users, anyone with a D1 dump.
- **Out of scope:** compromised client device, malicious browser extension, XSS that achieves code execution before lock (mitigated, not eliminated), lost recovery key, weak master password.

### 10.2 Controls
- Zero-knowledge envelope encryption; server has no decrypt path.
- PBKDF2-SHA256 600k for master key; HKDF domain separation (`bw-auth`, `bw-wrap`, `bw-recovery`).
- Server-side pepper (HMAC) on auth hash and backup codes; constant-time comparison.
- Random 96-bit IV per AES-GCM encryption; versioned envelope to allow migration.
- httpOnly + Secure + SameSite=Lax session cookie; hashed tokens in KV; revocation on password change.
- Per-IP/per-email rate limits; account lockout; 2FA replay protection.
- Nonce-based CSP, no third-party scripts, no `dangerouslySetInnerHTML`.
- No plaintext secrets in logs; generic client errors with request ids.
- TOTP seed encrypted server-side with a dedicated key because verification precedes unlock.
- Destructive secret rotation documented (pepper/TOTP key loss locks users out).

### 10.3 Known limitations (explicit)
- JavaScript cannot reliably zero secret strings in memory; we minimize lifetime and references, not guarantee erasure.
- Clipboard is shared with the OS; auto-clear is best-effort.
- KV session revocation is eventually consistent (seconds); D1 is the source of truth for account state.
- Free-tier D1 Time Travel is 7 days; backups beyond that are the owner's responsibility.
- No email means no account verification and no out-of-band alerting.

---

## 11. Development Phases

| Phase | Scope | Requirements |
|-------|-------|--------------|
| 0 — Foundation | Repo init, agent context, scaffold, bindings, migrations, verify gates, design system, tests | TASK-2 … TASK-6, TASK-57 … TASK-59 |
| 1 — Crypto core | KDF, wrapping, envelope, recovery key, tests | TASK-7 … TASK-17 |
| 2 — Account | Setup, login, sessions, 2FA, rate limits, admin, password change, recovery, auto-lock | TASK-18 … TASK-28 |
| 3 — Vault API | List/sync, CRUD, folders, authorization, validation | TASK-29 … TASK-35 |
| 4 — Vault client | Cache/sync, unlock state, list, search, editors, generator, TOTP, clipboard, trash, states, responsive | TASK-36 … TASK-47 |
| 5 — Hardening | Headers/CSP/CSRF, a11y, performance, PWA, audit, E2E, observability, docs, deploy | TASK-48 … TASK-56 |

### Phase 2 roadmap (post-MVP, not scheduled here)
1. Organizations/family sharing (activate dormant tables; roles; collections; key sharing per collection).
2. Attachments on R2 (client-side stream encryption, size caps, quotas).
3. Import/export compatible with Bitwarden JSON/CSV.
4. Send (one-time encrypted links).
5. Browser extension (MV3) and Android client on the shared contract.
6. Passkeys/WebAuthn for login (PRF where available).
7. Email flows (invites, alerts) via Cloudflare Email Routing/Workers.
8. Vault health (reused passwords, breached passwords via HIBP k-anonymity, weak items).

---

## 12. Assumptions and Dependencies

### Assumptions
1. Deployed on one Cloudflare account; no multi-tenant hosting.
2. Family scale: ≤ 5 users, ≤ 2,000 items per vault, ≤ 100k requests/month.
3. PBKDF2 600k completes under ~1s on target devices; if not, iterations are tuned with a versioned `kdf_iterations` field.
4. Users accept responsibility for storing their recovery key; no recovery otherwise.
5. English-only UI in MVP; catalog-based to allow translation later.
6. SSR is required by the toolchain; vault data therefore loads client-side after unlock.
7. `AUTH_PEPPER` and `TOTP_ENC_KEY` are stable for the life of the deployment.
8. D1 free tier (500MB) is sufficient; Time Travel provides the primary restore path.

### Dependencies
- React Router v8 + Cloudflare Vite plugin behavior (SSR only; no SPA/prerender).
- WebCrypto support for PBKDF2/HKDF/AES-GCM in target browsers (all modern evergreen browsers).
- Wrangler 4.x migration tooling and Rate Limiting binding availability on the chosen plan.
- IndexedDB availability (all target browsers); private-mode caveats documented in the UI.

### Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
| CSP nonce vs React Router inline hydration scripts | Blocks strict CSP | Validate in TASK-48; document minimal exception if unavoidable |
| PBKDF2 600k too slow on low-end mobile | Poor unlock UX | Versioned iterations + measured budget in TASK-17/50 |
| D1 single-threaded write contention | Slow saves at scale | `batch()` writes; scale target is family-size |
| Offline conflict complexity | Data loss or confusing UX | Explicit 409 + refetch; never silent last-write-wins |
| Losing `AUTH_PEPPER` / `TOTP_ENC_KEY` | All users locked out | Documented as destructive; backup runbook in TASK-55 |
| Vault route SSR leaking ciphertext into HTML | Privacy/caching leak | Client-only loading for vault routes; verified in TASK-50 |
