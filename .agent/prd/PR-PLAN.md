# Bridgewarden — PR Grouping Plan

**Purpose:** map the 59 requirement IDs in `.agent/prd/PRD.md` (TASK-1 prerequisite gate + 58 feature requirements) onto reviewable pull requests.
**Status:** proposal only. No application code has been written.
**Source of truth for scope:** `.agent/prd/PRD.md`
**Mapping source:** requirement IDs `TASK-1` … `TASK-56` plus `TASK-57` … `TASK-59`

> **Two ID spaces, do not mix them up:**
> - **Requirement IDs** (`TASK-1` … `TASK-59`) live in the PRD and are cited in `requirementIds` inside each task spec.
> - **Task/PR IDs** (`TASK-1` … `TASK-19` in `.agent/tasks.json`) are PR units, mapped to PR numbers `00` … `18` below.
> Only `TASK-1` has the same meaning in both spaces (prerequisite gate and PR 00).

---

## 1. Grouping rules

1. One PR = one coherent feature slice that a reviewer can understand without reading the whole PRD.
2. Every PR leaves `main` green: typecheck, unit tests, and existing E2E pass.
3. PRs are stacked in the order below. A PR branches from the latest merged prerequisite, not from a long-lived feature branch.
4. A PR may contain multiple requirement IDs, but it must not contain two unrelated surfaces (e.g. crypto + UI).
5. UI PRs include a screenshot or short recording in the PR body.
6. Security-sensitive PRs (crypto, auth, headers) require a second reviewer or a self-review checklist in the PR body.
7. No PR adds features marked non-goal in PRD §1.5.
8. Requirement IDs appear in the PR title or body so scope is auditable.

**Branch naming:** `feat/<area>-<slice>`, `chore/<slice>`, `test/<slice>`, `docs/<slice>`.
**PR body template:** What changed · Requirement IDs · How verified · Risk/rollback · Screenshots (UI PRs).

---

## 2. PR map

| # | PR | Branch | Requirements | Depends on | Size | Review focus |
|---|----|--------|--------------|-----------|------|--------------|
| 00 | Prerequisites, repo init, and agent context | `chore/prerequisites` | TASK-1, TASK-57, TASK-58 | — | S | Provisioning checklist, git/editorconfig, AGENTS.md contract |
| 01 | Scaffold Worker, bindings, migrations tooling, verify gates | `chore/scaffold-foundation` | TASK-2, TASK-3, TASK-4, TASK-59 | 00 | M | Wrangler config, typed env, lint/CI gates, no secrets in client bundle |
| 02 | Design system, shell, copy catalog | `feat/ui-foundation` | TASK-5 | 01 | M | Theme tokens, catalog coverage, no third-party assets |
| 03 | Test harness (Vitest + Playwright) | `chore/test-harness` | TASK-6 | 01 | M | Isolation from dev DB, failure exit codes |
| 04 | Database schema + dormant org tables | `feat/db-schema` | TASK-7 … TASK-12 | 01 | M | Constraints, indexes, no plaintext columns |
| 05 | Crypto core + vault recovery key | `feat/crypto-core` | TASK-13 … TASK-17 | 01, 03 | L | KDF params, IV handling, tamper rejection, vectors |
| 06 | First-run setup wizard | `feat/setup-wizard` | TASK-18 | 02, 04, 05 | M | Atomic bootstrap, token gate, refresh safety |
| 07 | Login, sessions, route guard, logout | `feat/auth-sessions` | TASK-19, TASK-20 | 02, 04, 05 | M | Generic errors, cookie flags, KV hashing |
| 08 | TOTP 2FA + backup codes | `feat/auth-2fa` | TASK-21, TASK-22, TASK-23 | 07 | M | Replay protection, seed never returned |
| 09 | Rate limiting, lockout, admin users | `feat/auth-abuse-admin` | TASK-24, TASK-25 | 06, 07, 08 | M | Bypass paths, last-admin guard |
| 10 | Change password, recovery reset, auto-lock | `feat/account-security` | TASK-26, TASK-27, TASK-28 | 05, 07, 08 | L | Key rewrap correctness, session revocation |
| 11 | Vault API (sync, CRUD, trash, folders, authz) | `feat/vault-api` | TASK-29 … TASK-35 | 04, 07, 09 | L | Cross-user isolation, rev conflicts, payload caps |
| 12 | Client cache, outbox, sync engine, key lifetime | `feat/vault-client-core` | TASK-36, TASK-37 | 05, 10, 11 | L | No plaintext key persistence, offline replay |
| 13 | Vault list, filters, keyboard, search | `feat/vault-list` | TASK-38, TASK-39 | 02, 12 | M | Client-only search, list performance |
| 14 | Login and secure note editors | `feat/vault-editors` | TASK-40, TASK-41 | 13 | M | Encryption on save, unsaved-change guard |
| 15 | Password generator, TOTP item, clipboard | `feat/vault-tools` | TASK-42, TASK-43, TASK-44 | 14 | M | CSPRNG, RFC 6238 vectors, clipboard clear |
| 16 | Trash UI, states, responsive mobile | `feat/ui-polish` | TASK-45, TASK-46, TASK-47 | 13, 14, 15 | M | Destructive confirmations, 360px usability |
| 17 | Headers/CSP/CSRF + a11y + perf + PWA | `feat/hardening` | TASK-48, TASK-49, TASK-50, TASK-51 | 16 | L | CSP nonce vs RR inline scripts, budgets, axe |
| 18 | Audit, E2E suite, docs, deploy | `feat/release` | TASK-52, TASK-53, TASK-54, TASK-55, TASK-56 | 17 | L | No plaintext logs, smoke checklist, runbook |

**Size key:** XS < 1h · S half-day · M 1–2 days · L 2–4 days.
Sizes are review surface, not calendar promises.

---

## 3. Per-PR definition of done

Every PR below must additionally satisfy:

- Typecheck and build pass.
- New unit tests cover new logic; no coverage regression on crypto/auth modules.
- New routes and handlers have at least one integration test.
- No secret, email, password, auth hash, TOTP code, or ciphertext appears in logs.
- Requirement IDs listed in the PR body.
- Any deviation from the PRD is called out explicitly and approved in the PR thread.

### PR 00 — Prerequisites, repo init, agent context
Checklist: wrangler auth, D1/KV created, ids in `wrangler.jsonc`, `.env.local` + `.dev.vars` placeholders filled manually, docs reachable. Repository scaffolding: `git init` with `main`, `.gitignore`, `.editorconfig`, Conventional Commits and PR title conventions, and `AGENTS.md` describing verify commands, architecture invariants, required reading, and the secret policy. No `package.json`, no application source, no dependencies.

### PR 01 — Foundation and verify gates
React Router v8 + Cloudflare Vite plugin scaffold (SSR), `wrangler.jsonc` bindings, typed `Env`, secret accessor with generic failures, migration scripts, `/health` proving D1, gitignore rules, plus `tsc --noEmit` strict, ESLint/Biome, Prettier, `packageManager` and `.nvmrc` pins, and a CI workflow running install → typecheck → lint → test → build. Scaffolding into a non-empty directory must preserve PR 00 artifacts.

### PR 02 — UI foundation
Tailwind tokens, shadcn primitives, `AppShell`, theme provider (light/dark/system), message catalog, placeholder routes. No vault logic.

### PR 03 — Test harness
Vitest Workers pool with isolated test D1, Playwright with `webServer`, domain fixtures, trace/screenshot on failure.

### PR 04 — Schema
Migrations for `users`, `vault_items`, `folders`, `user_2fa`, `backup_codes`, `audit_events`, plus dormant `orgs`/`org_members`/`collections`/`collection_items`. Constraints and indexes per PRD §8. Cascade behavior proven by test.

### PR 05 — Crypto core + recovery key
WebCrypto module: PBKDF2-SHA256 600k → masterKey, HKDF domains (`bw-auth`, `bw-wrap`, `bw-recovery`), authHash, random vaultKey, wrap/unwrap, AES-256-GCM envelope v1, recovery secret format, known-answer and tamper tests, unlock benchmark. No UI beyond a recovery-key confirmation component.

### PR 06 — Setup wizard
`/setup` server route guarded by user count, atomic `INSERT … WHERE NOT EXISTS`, `BOOTSTRAP_TOKEN` gate, multi-step UI, recovery confirmation, optional 2FA enrollment handoff, audit event.

### PR 07 — Auth sessions
`/login` password step, generic 401, KV session store keyed by token hash, httpOnly/Secure/SameSite cookie, session resolver, `/app` guard, logout, revoke helper. No 2FA yet.

### PR 08 — 2FA
TOTP secret generation + encryption with `TOTP_ENC_KEY`, QR/otpauth enrollment, challenge token flow, ±1 step window, `last_totp_step` replay protection, 10 single-use backup codes stored as HMACs, regeneration.

### PR 09 — Abuse + admin
Rate limiting binding on auth routes, account lockout columns and reset rules, admin user list/create/disable/enable, one-time 24h setup token instead of email, session revocation, last-active-admin guard.

### PR 10 — Account security
Change master password with key rewrap (no item re-encryption), other-session revocation, `/recover` via recovery key with forced new password and burned recovery key, auto-lock timer + overlay + local re-unlock + logout after 5 failures.

### PR 11 — Vault API
Incremental sync with `since` + tombstones, item create/update/delete/restore/purge, folder CRUD, per-user scoping with 404 on foreign ids, Zod validation and size caps, daily purge cron, `rev` conflict handling.

### PR 12 — Vault client core
IndexedDB stores (items, folders, wrappedKeys, syncState, outbox), optimistic mutations, ordered flush, 409 reconciliation, wipe on logout, module-scoped `vaultKey` with lock/unlock lifecycle.

### PR 13 — Vault list
Rows with decrypted name/metadata, sort/filter, keyboard navigation, `Ctrl/Cmd+K`, in-memory debounced search over decrypted fields, empty state.

### PR 14 — Editors
Login editor (name, username, password, URLs, notes, folder, favorite, TOTP secret, custom fields) and secure note editor, encryption on save, validation, unsaved-change guard.

### PR 15 — Vault tools
Password generator (length/sets/passphrase/strength, `getRandomValues`), RFC 6238 TOTP generator with countdown and secret parsing, copy/reveal with 30s auto-clear and toast confirmation.

### PR 16 — Polish
Trash route with restore/purge confirmations, skeletons/empty/error/offline states, responsive layouts at 360/768/1024, full-screen editor sheet on mobile.

### PR 17 — Hardening
Nonce-based CSP (verify React Router inline hydration scripts), HSTS/nosniff/referrer/permissions headers, Origin/Host CSRF checks, WCAG AA pass with axe, route splitting and performance budgets, no ciphertext in SSR HTML, PWA manifest + shell SW with update prompt.

### PR 18 — Release
Audit events for auth/admin mutations, Workers Logs with redaction rules, Playwright critical-flow suite, README + threat model + runbook, remote migrations + Worker secrets, production smoke checklist.

---

## 4. Merge order and parallelism

**Strictly sequential backbone (cannot be reordered):**
`00 → 01 → 02/03/04 → 05 → 06/07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18`

**Safe to parallelize after their dependencies merge:**

| After | Can run in parallel |
|-------|---------------------|
| 01 | 02, 03, 04 |
| 05 | 06 and 07 |
| 08 | 09 and 10 |
| 13 | 14 and 16 (16 needs 14+15 for full scope) |
| 16 | 17 (a11y/perf portions can start earlier on 13–15) |

**Not parallelizable:** 05 before 06/07/10 (crypto contract), 11 before 12 (API shape), 12 before 13 (cache), 17 before 18 (deploy verification).

---

## 5. Requirement → PR traceability

| Requirement | PR | Requirement | PR |
|---|---|---|---|
| TASK-1, 57, 58 | 00 | TASK-29 | 11 |
| TASK-2, 3, 4, 59 | 01 | TASK-30 | 11 |
| TASK-5 | 02 | TASK-31 | 11 |
| TASK-6 | 03 | TASK-32 | 11 |
| TASK-7, 8, 9, 10, 11, 12 | 04 | TASK-33 | 11 |
| TASK-13, 14, 15, 16, 17 | 05 | TASK-34 | 11 |
| TASK-18 | 06 | TASK-35 | 11 |
| TASK-19, 20 | 07 | TASK-36, 37 | 12 |
| TASK-21, 22, 23 | 08 | TASK-38, 39 | 13 |
| TASK-24, 25 | 09 | TASK-40, 41 | 14 |
| TASK-26, 27, 28 | 10 | TASK-42, 43, 44 | 15 |
| TASK-45, 46, 47 | 16 | TASK-48, 49, 50, 51 | 17 |
| TASK-52, 53, 54, 55, 56 | 18 | | |

Coverage check: 59 requirement IDs, 59 mapped exactly once, zero unmapped, zero duplicated. Requirement IDs 57–59 were added for repository initialization, agent context, and verify gates so PR 00 and PR 01 have explicit traceability.

---

## 6. Notes and open decisions

1. **PR 17 is the riskiest single PR.** CSP nonce against React Router's inline hydration scripts may force a documented minimal exception. If it does, split PR 17 into `feat/security-headers` and `feat/perf-pwa` to isolate the risk.
2. **PR 11 is the largest API surface.** If review drags, split into `feat/vault-api-items`, `feat/vault-api-folders`, `feat/vault-api-hardening` without changing requirement mapping.
3. **PR 09 depends on PR 08** only for the admin ability to reset 2FA; the rate limiting half could ship earlier if needed.
4. **Phase 2 items are intentionally absent** from this plan: organizations activation, attachments, import/export, Send, extension, Android, passkeys, email flows, vault health.
5. **Task spec files are grouped to match this plan.** `.agent/tasks.json` now has 19 entries: `TASK-1` for PR 00 and `TASK-2` … `TASK-19` for PR 01 … PR 18. Each spec file carries a `pullRequest` block with title, branch, requirement IDs, in-scope, and out-of-scope.
