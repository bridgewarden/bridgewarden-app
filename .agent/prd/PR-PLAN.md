# Bridgewarden — PR Grouping Plan

**Purpose:** map the 59 requirement IDs in `.agent/prd/PRD.md` (TASK-1 prerequisite gate + 58 feature requirements) onto reviewable pull requests `#1` … `#20`.
**Status:** active plan. PRs `#1` … `#4` are merged; `#3` was the OpenSpec initialization.
**Source of truth for scope:** `.agent/prd/PRD.md`
**Mapping source:** requirement IDs `TASK-1` … `TASK-56` plus `TASK-57` … `TASK-59`

> **Two ID spaces, do not mix them up:**
> - **Requirement IDs** (`TASK-1` … `TASK-59`) live in the PRD and are cited in `requirementIds` inside each task spec.
> - **Task/PR IDs** (`TASK-1` … `TASK-19` in `.agent/tasks.json`) are PR units, mapped to the GitHub pull-request numbers `#1` … `#20` below.
> Only `TASK-1` has the same meaning in both spaces (prerequisite gate and PR #1).
>
> **Numbering rule:** plan numbers are GitHub pull-request numbers. If a PR is opened that is not in this plan, add it here with its assigned number before opening the next planned PR, so later slots do not drift.

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
9. Plan numbers must equal GitHub PR numbers; see the numbering rule above.

**Branch naming:** `feat/<area>-<slice>`, `chore/<slice>`, `test/<slice>`, `docs/<slice>`.
**PR body template:** What changed · Requirement IDs · How verified · Risk/rollback · Screenshots (UI PRs).

---

## 2. PR map

| # | PR | Branch | Requirements | Depends on | Size | Review focus |
|---|----|--------|--------------|-----------|------|--------------|
| #1 | Prerequisites, repo init, and agent context | `chore/prerequisites` | TASK-1, TASK-57, TASK-58 | — | S | Provisioning checklist, git/editorconfig, AGENTS.md contract |
| #2 | Scaffold Worker, bindings, migrations tooling, verify gates | `chore/scaffold-foundation` | TASK-2, TASK-3, TASK-4, TASK-59 | #1 | M | Wrangler config, typed env, lint/CI gates, no secrets in client bundle |
| #3 | OpenSpec initialization (done) | `chore/openspec-init` | — | #1 | S | Tooling only: schema, commands, skills |
| #4 | Design system, shell, copy catalog | `feat/ui-foundation` | TASK-5 | #2 | M | Theme tokens, catalog coverage, no third-party assets |
| #5 | Test harness (Vitest + Playwright) | `chore/test-harness` | TASK-6 | #2 | M | Isolation from dev DB, failure exit codes |
| #6 | Database schema + dormant org tables | `feat/db-schema` | TASK-7 … TASK-12 | #2 | M | Constraints, indexes, no plaintext columns |
| #7 | Crypto core + vault recovery key | `feat/crypto-core` | TASK-13 … TASK-17 | #2, #5 | L | KDF params, IV handling, tamper rejection, vectors |
| #8 | First-run setup wizard | `feat/setup-wizard` | TASK-18 | #4, #6, #7 | M | Atomic bootstrap, token gate, refresh safety |
| #9 | Login, sessions, route guard, logout | `feat/auth-sessions` | TASK-19, TASK-20 | #4, #6, #7 | M | Generic errors, cookie flags, KV hashing |
| #10 | TOTP 2FA + backup codes | `feat/auth-2fa` | TASK-21, TASK-22, TASK-23 | #9 | M | Replay protection, seed never returned |
| #11 | Rate limiting, lockout, admin users | `feat/auth-abuse-admin` | TASK-24, TASK-25 | #8, #9, #10 | M | Bypass paths, last-admin guard |
| #12 | Change password, recovery reset, auto-lock | `feat/account-security` | TASK-26, TASK-27, TASK-28 | #7, #9, #10 | L | Key rewrap correctness, session revocation |
| #13 | Vault API (sync, CRUD, trash, folders, authz) | `feat/vault-api` | TASK-29 … TASK-35 | #6, #9, #11 | L | Cross-user isolation, rev conflicts, payload caps |
| #14 | Client cache, outbox, sync engine, key lifetime | `feat/vault-client-core` | TASK-36, TASK-37 | #7, #12, #13 | L | No plaintext key persistence, offline replay |
| #15 | Vault list, filters, keyboard, search | `feat/vault-list` | TASK-38, TASK-39 | #4, #14 | M | Client-only search, list performance |
| #16 | Login and secure note editors | `feat/vault-editors` | TASK-40, TASK-41 | #15 | M | Encryption on save, unsaved-change guard |
| #17 | Password generator, TOTP item, clipboard | `feat/vault-tools` | TASK-42, TASK-43, TASK-44 | #16 | M | CSPRNG, RFC 6238 vectors, clipboard clear |
| #18 | Trash UI, states, responsive mobile | `feat/ui-polish` | TASK-45, TASK-46, TASK-47 | #15, #16, #17 | M | Destructive confirmations, 360px usability |
| #19 | Headers/CSP/CSRF + a11y + perf + PWA | `feat/hardening` | TASK-48, TASK-49, TASK-50, TASK-51 | #18 | L | CSP nonce vs RR inline scripts, budgets, axe |
| #20 | Audit, E2E suite, docs, deploy | `feat/release` | TASK-52, TASK-53, TASK-54, TASK-55, TASK-56 | #19 | L | No plaintext logs, smoke checklist, runbook |

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

### PR #1 — Prerequisites, repo init, agent context
Checklist: wrangler auth, D1/KV created, ids in `wrangler.jsonc`, `.env.local` + `.dev.vars` placeholders filled manually, docs reachable. Repository scaffolding: `git init` with `main`, `.gitignore`, `.editorconfig`, Conventional Commits and PR title conventions, and `AGENTS.md` describing verify commands, architecture invariants, required reading, and the secret policy. No `package.json`, no application source, no dependencies.

### PR #2 — Foundation and verify gates
React Router v8 + Cloudflare Vite plugin scaffold (SSR), `wrangler.jsonc` bindings, typed `Env`, secret accessor with generic failures, migration scripts, `/health` proving D1, gitignore rules, plus `tsc --noEmit` strict, ESLint/Biome, Prettier, `packageManager` and `.nvmrc` pins, and a CI workflow running install → typecheck → lint → test → build. Scaffolding into a non-empty directory must preserve PR #1 artifacts.

### PR #3 — OpenSpec initialization (done)
`openspec init` with the spec-driven schema, `openspec/config.yaml`, specs and changes scaffolding, and the Command Code plus universal `.agents` workflows (propose, apply, archive, explore, sync). Tooling only; no application code.

### PR #4 — UI foundation
Tailwind tokens declared with `light-dark()`, the 16 shadcn/ui primitives, `AppShell`, theme cookie applied during SSR, typed message catalog, placeholder pages for `/login`, `/setup`, `/app`, and `/app/trash` under a pass-through protected layout. No vault logic.

### PR #5 — Test harness
Vitest Workers pool with isolated test D1, Playwright with `webServer`, domain fixtures, trace/screenshot on failure.

### PR #6 — Schema
Migrations for `users`, `vault_items`, `folders`, `user_2fa`, `backup_codes`, `audit_events`, plus dormant `orgs`/`org_members`/`collections`/`collection_items`. Constraints and indexes per PRD §8. Cascade behavior proven by test.

### PR #7 — Crypto core + recovery key
WebCrypto module: PBKDF2-SHA256 600k → masterKey, HKDF domains (`bw-auth`, `bw-wrap`, `bw-recovery`), authHash, random vaultKey, wrap/unwrap, AES-256-GCM envelope v1, recovery secret format, known-answer and tamper tests, unlock benchmark. No UI beyond a recovery-key confirmation component.

### PR #8 — Setup wizard
`/setup` server route guarded by user count, atomic `INSERT … WHERE NOT EXISTS`, multi-step UI, recovery confirmation, optional 2FA enrollment handoff, audit event.

### PR #9 — Auth sessions
`/login` password step, generic 401, KV session store keyed by token hash, httpOnly/Secure/SameSite cookie, session resolver, `/app` guard, logout, revoke helper. No 2FA yet.

### PR #10 — 2FA
TOTP secret generation + encryption with `TOTP_ENC_KEY`, QR/otpauth enrollment, challenge token flow, ±1 step window, `last_totp_step` replay protection, 10 single-use backup codes stored as HMACs, regeneration.

### PR #11 — Abuse + admin
Rate limiting binding on auth routes, account lockout columns and reset rules, admin user list/create/disable/enable, one-time 24h setup token instead of email, session revocation, last-active-admin guard.

### PR #12 — Account security
Change master password with key rewrap (no item re-encryption), other-session revocation, `/recover` via recovery key with forced new password and burned recovery key, auto-lock timer + overlay + local re-unlock + logout after 5 failures.

### PR #13 — Vault API
Incremental sync with `since` + tombstones, item create/update/delete/restore/purge, folder CRUD, per-user scoping with 404 on foreign ids, Zod validation and size caps, daily purge cron, `rev` conflict handling.

### PR #14 — Vault client core
IndexedDB stores (items, folders, wrappedKeys, syncState, outbox), optimistic mutations, ordered flush, 409 reconciliation, wipe on logout, module-scoped `vaultKey` with lock/unlock lifecycle.

### PR #15 — Vault list
Rows with decrypted name/metadata, sort/filter, keyboard navigation, `Ctrl/Cmd+K`, in-memory debounced search over decrypted fields, empty state.

### PR #16 — Editors
Login editor (name, username, password, URLs, notes, folder, favorite, TOTP secret, custom fields) and secure note editor, encryption on save, validation, unsaved-change guard.

### PR #17 — Vault tools
Password generator (length/sets/passphrase/strength, `getRandomValues`), RFC 6238 TOTP generator with countdown and secret parsing, copy/reveal with 30s auto-clear and toast confirmation.

### PR #18 — Polish
Trash route with restore/purge confirmations, skeletons/empty/error/offline states, responsive layouts at 360/768/1024, full-screen editor sheet on mobile.

### PR #19 — Hardening
Nonce-based CSP (verify React Router inline hydration scripts), HSTS/nosniff/referrer/permissions headers, Origin/Host CSRF checks, WCAG AA pass with axe, route splitting and performance budgets, no ciphertext in SSR HTML, PWA manifest + shell SW with update prompt.

### PR #20 — Release
Audit events for auth/admin mutations, Workers Logs with redaction rules, Playwright critical-flow suite, README + threat model + runbook, remote migrations + Worker secrets, production smoke checklist.

---

## 4. Merge order and parallelism

**Strictly sequential backbone (cannot be reordered):**
`#1 → #2 → #3 (done) → #4/#5/#6 → #7 → #8/#9 → #10 → #11 → #12 → #13 → #14 → #15 → #16 → #17 → #18 → #19 → #20`

**Safe to parallelize after their dependencies merge:**

| After | Can run in parallel |
|-------|---------------------|
| #2 | #3, #4, #5, #6 |
| #7 | #8 and #9 |
| #10 | #11 and #12 |
| #15 | #16 and #18 (#18 needs #16 + #17) |
| #18 | #19 (a11y/perf portions can start earlier on #15–#17) |

**Not parallelizable:** #7 before #8/#9/#12 (crypto contract), #13 before #14 (API shape), #14 before #15 (cache), #19 before #20 (deploy verification).

---

## 5. Requirement → PR traceability

| Requirement | PR | Requirement | PR |
|---|---|---|---|
| TASK-1, 57, 58 | #1 | TASK-29 | #13 |
| TASK-2, 3, 4, 59 | #2 | TASK-30 | #13 |
| — (tooling) | #3 | TASK-31 | #13 |
| TASK-5 | #4 | TASK-32 | #13 |
| TASK-6 | #5 | TASK-33 | #13 |
| TASK-7, 8, 9, 10, 11, 12 | #6 | TASK-34 | #13 |
| TASK-13, 14, 15, 16, 17 | #7 | TASK-35 | #13 |
| TASK-18 | #8 | TASK-36, 37 | #14 |
| TASK-19, 20 | #9 | TASK-38, 39 | #15 |
| TASK-21, 22, 23 | #10 | TASK-40, 41 | #16 |
| TASK-24, 25 | #11 | TASK-42, 43, 44 | #17 |
| TASK-26, 27, 28 | #12 | TASK-45, 46, 47 | #18 |
| TASK-48, 49, 50, 51 | #19 | TASK-52, 53, 54, 55, 56 | #20 |

Coverage check: 59 requirement IDs, 59 mapped exactly once, zero unmapped, zero duplicated. PR #3 is tooling and maps to no requirement. Requirement IDs 57–59 were added for repository initialization, agent context, and verify gates so PR #1 and PR #2 have explicit traceability.

---

## 6. Notes and open decisions

1. **PR #19 is the riskiest single PR.** CSP nonce against React Router's inline hydration scripts may force a documented minimal exception. If it does, split PR #19 into `feat/security-headers` and `feat/perf-pwa` to isolate the risk.
2. **PR #13 is the largest API surface.** If review drags, split into `feat/vault-api-items`, `feat/vault-api-folders`, `feat/vault-api-hardening` without changing requirement mapping.
3. **PR #11 depends on PR #10** only for the admin ability to reset 2FA; the rate limiting half could ship earlier if needed.
4. **Phase 2 items are intentionally absent** from this plan: organizations activation, attachments, import/export, Send, extension, Android, passkeys, email flows, vault health.
5. **Task spec files are grouped to match this plan.** `.agent/tasks.json` has 19 entries: `TASK-1` for PR #1, `TASK-2` for PR #2, and `TASK-3` … `TASK-19` for PR #4 … PR #20. PR #3 has no task file because it is completed infrastructure. Each spec file carries a `pullRequest` block with title, branch, requirement IDs, in-scope, and out-of-scope.
