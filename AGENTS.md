# AGENTS.md — Bridgewarden

Entry point for any AI agent working in this repository. Read this before changing code.

## What this is

A zero-knowledge password manager for personal and family use, deployed entirely on
Cloudflare as one React Router v8 Worker (SSR) with D1 and KV. The web app is the only
surface in this repository; the browser extension and Android client are separate future
projects that reuse the same crypto and API contract.

## Required reading, in order

1. `.agent/prd/SUMMARY.md` — one-page context
2. `.agent/prd/PRD.md` — requirements, requirement IDs `TASK-1` … `TASK-59`
3. `.agent/prd/PR-PLAN.md` — how requirements group into PRs `#1` … `#20`
4. `.agent/tasks.json` — PR-level task index, `passes` flags

Two ID spaces exist and are not interchangeable: **requirement IDs** (`TASK-1` … `TASK-59` in
the PRD) and **PR task IDs** (`TASK-1` … `TASK-19` in `.agent/tasks.json`). Only `TASK-1`
means the same thing in both.

## Hard invariants — do not violate

1. **Zero knowledge.** No vault plaintext (name, username, password, URL, notes, custom
   fields, item TOTP secret, folder name) may reach the server, a log, SSR HTML, or
   non-encrypted storage.
2. **Crypto is client-only.** The server has no decrypt path for `vault_items.data_ct` or
   `folders.name_ct`. The one exception is the account 2FA TOTP seed, which is encrypted at
   rest with `TOTP_ENC_KEY` because verification happens before unlock.
3. **The vault key never leaves memory.** Never in React state, localStorage, sessionStorage,
   IndexedDB plaintext, URLs, logs, or network payloads.
4. **No ciphertext in SSR HTML.** Vault routes load data client-side after unlock.
5. **Secrets stay in `.dev.vars` / Worker secrets.** Never in `wrangler.jsonc` vars, source,
   fixtures, tests, screenshots, PR bodies, or chat.
6. **No third-party scripts, fonts, or analytics.** CSP is nonce-based.
7. **Server authorization comes from the session.** Never read `user_id` from a request body
   or query; foreign ids return 404.
8. **Non-goals stay out.** No organizations, attachments, import/export, Send, passkeys,
   email flows, extension, or Android work in the MVP.

## Commands

These exist from PR #2 onward. Until then, a missing script is a blocker, not a pass.

```bash
pnpm dev              # Workers runtime via the Cloudflare Vite plugin
pnpm build
pnpm typecheck        # tsc --noEmit, strict
pnpm lint
pnpm format:check
pnpm test             # Vitest, Workers pool
pnpm test:e2e         # Playwright (available from PR #5)
pnpm db:migrate:local
pnpm db:migrate:remote
pnpm db:reset:local
```

Local secrets live in `.dev.vars` (Wrangler) and `.env.local` (tooling); both are gitignored
and both must be filled manually. Never generate and commit real values.

`pnpm dev` forces `NODE_ENV=development`. This shell may export `NODE_ENV=production`, which
breaks the SSR JSX runtime (`_jsxDEV is not a function`); do not remove that prefix.

## Project structure

```
app/
├── root.tsx                 # document shell, Layout, root ErrorBoundary
├── routes.ts                # the only route registry
├── app.css                  # Tailwind entry
├── routes/                  # transport only: meta, loader, action, headers, middleware
├── features/<feature>/      # page entry, components/, and feature-suffixed UI modules
├── server/<domain>/         # shared domain server code, created on first extraction
├── components/              # global UI; components/ui/ is generated shadcn source
├── hooks/                   # global hooks
├── assets/                  # imported static assets
├── lib/                     # client-safe shared code
│   ├── .server/             # server infrastructure: db, env, session, verify, totp, audit
│   ├── crypto/              # client-only crypto contract, kdf, envelope, recovery
│   ├── vault/               # client cache, sync, outbox, selectors, key store, lock
│   └── i18n/                # message catalog (English, i18n-ready)
├── db/                      # D1 row types and shared database helpers
├── types/                   # shared types
├── constants/               # shared constants
└── __test__/                # shared Vitest setup, fixtures, cross-cutting integration test
migrations/                  # forward-only D1 migrations
e2e/                         # Playwright specs
workers/app.ts               # Worker entry, cron and handlers
.agent/                      # PRD, plan, tasks
.agents/skills/              # project skills
```

Features planned for the MVP: `setup`, `login`, `two-factor`, `recover`,
`account-settings`, `admin-users`, `vault-list`, `vault-item`, `vault-trash`, `generator`.

## Routing

- Every route is declared explicitly in `app/routes.ts` with `index`, `route`, `layout`, or
  `prefix`. Adding a file to `app/routes/` does nothing until it is listed in `routes.ts`.
- Route modules import generated types from `./+types/<route>`; never hand-write them and
  never commit `.react-router/`.
- Route modules are transport only: parse input, call one server function, return data,
  redirect, or render. Page UI lives in the feature.
- A page entry is `features/<feature>/<feature>.tsx` plus `index.ts` that default-exports it.
  The route renders it and passes route data as props.
- A page entry is never nested. A second page is a new top-level feature, not
  `features/<feature>/pages/` and not `*.page.tsx`.
- Protected UI lives under the `routes/protected.tsx` layout, which resolves the session and
  renders `<Outlet />`. Unauthenticated access redirects to `/login?next=…` with a validated
  same-origin target. Before the first admin exists, `/` and `/app/*` redirect to `/setup` first.
- Every non-GET action checks the request `Origin`. Mutation-only routes export no component.

## Data loading

- Server data comes from `loader`; mutations from `action`.
- **Vault exception:** vault content is never loaded by a server loader. Vault routes use
  `clientLoader` or a client fetch after unlock, because the server cannot read ciphertext and
  ciphertext must not be embedded in SSR HTML. Server loaders on vault routes return only
  session and user metadata.
- Read data through `Route.ComponentProps`. No `fetch` inside components.
- Client cache, sync, and outbox live in `app/lib/vault/` and are hardware-agnostic of React.
- `context` in `loader`, `action`, and `middleware` is a `RouterContextProvider` in v8. Read
  Cloudflare bindings with `context.get(cloudflareContext)` from `app/lib/.server/context.ts`;
  the provider has no `cloudflare` property.

## Server layer

| Scope                                                                                 | Location                                             |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Shared by client and server                                                           | `app/lib/*.ts`                                       |
| Server infrastructure (db, env, session, verify, totp, token, rate limit, audit, log) | `app/lib/.server/`                                   |
| Domain logic used by 2+ features                                                      | `app/server/<domain>/`                               |
| Everything specific to one feature                                                    | `features/<feature>/.server/`                        |
| One route-facing operation                                                            | `features/<feature>/.server/use-cases/<use-case>.ts` |
| Raw SQL for one table                                                                 | `features/<feature>/.server/queries/<table>.ts`      |
| Fixed policy values                                                                   | `features/<feature>/.server/constants/<domain>.ts`   |

- Server-only code lives in a `.server.ts` file or a `.server/` directory. React Router keeps
  both out of the client module graph.
- Client code may import `app/lib/*.ts` but never `app/lib/.server/`,
  `features/<feature>/.server/`, or `app/server/`.
- Dependencies point one way: `routes -> features -> app/server -> app/lib -> db`.
- Features never import another feature. Shared domain logic is extracted to `app/server/`.
- A route module contains no SQL, no business rules, and no logging.
- `app/lib/.server/db.ts` owns the D1 handle. Query modules take the handle as a parameter
  with a default; do not construct clients elsewhere.
- Migrations stay in `migrations/` and are applied with Wrangler, never at request time.

## File naming

- kebab-case for every file: `vault-item.tsx`, not `VaultItem.tsx`.
- Suffixes: `*.hooks.ts`, `*.types.ts`, `*.constants.ts`, `*.schema.ts`, `*.test.ts(x)`, and
  `*.spec.ts` for Playwright specs in `e2e/` only.
- Server-only: `.server.ts` or a `.server/` directory (files inside need no suffix).
- A component with one file is `components/<name>.tsx`; a directory with `index.ts` only when
  two or more public files are exported.
- Names carry their own context: `backup-codes.ts`, not `codes.ts`.
- Avoid `data.ts`, `helpers.ts`, `utils.ts`, `constants.ts` when a domain word exists.
- Feature UI code uses `<feature>.<suffix>.ts` while a file stays small; see "Feature UI structure".

## Feature UI structure

- `features/<feature>/<feature>.tsx` is page composition only: no response types, fetcher/effect
  flow, constants, or pure helpers.
- Feature-owned components live in `features/<feature>/components/<component>.tsx`. A
  `components/index.ts` barrel is allowed when two or more components are public.
- Non-component UI code uses feature-suffixed files: `<feature>.hooks.ts`,
  `<feature>.constants.ts`, `<feature>.lib.ts`, `<feature>.types.ts`, and `<feature>.state.ts`.
- Keep a suffixed file while it exports at most ten functions/hooks. Above ten, split it by
  concern into `hooks/` or `lib/` and add a barrel there. Exported types and constants do not
  count toward the threshold.
- A file over roughly 200 lines must be split by concern even if it exports only one function.
- Import through a barrel from outside the directory; import concrete files inside it to avoid
  cycles. Never barrel page entries or server code.
- Components receive data and callbacks through props and never import the page.
- UI shared by two or more features moves to `app/components/`. Features never import another
  feature.
- Domain-named modules stay descriptive when the name is the context, such as `setup-keys.ts`
  or `.server/use-cases/<use-case>.ts`.
- This section covers UI only; server layout and `.server/` rules stay unchanged.

## Code style

- Single quotes, semicolons, 2-space indent, 120-column limit (Prettier enforces this).
- Arrow-function components: `export const VaultList = () => ...`. Route modules may keep
  `export default function Component` to match the React Router template.
- `import type` for type-only imports. No explicit `any`.
- Import order: `react` → external packages → `~/` alias → relative → CSS.
- Comments only for non-obvious intent; never restate the code.
- Icons: lucide icons with the `Icon` suffix (`ClockIcon`).
- shadcn source in `app/components/ui/` is generated: change tokens in `app/app.css`, do not
  restyle individual primitives.

## UI

- Design tokens live in `app/app.css` and are declared once with `light-dark()`; `color-scheme` on
  `.light`/`.dark` (or the OS preference) selects the value. Never use raw color values in
  components; use the semantic Tailwind roles. `light-dark()` needs Chrome/Edge 123+, Safari 17.5+,
  Firefox 120+.
- Generated primitives live in `app/components/ui/`. Treat them as owned source but do not restyle
  an individual primitive; change a token or the shared variant instead.
- `cn` is the only class merge helper and lives in `app/lib/class-names.ts`. `components.json`
  points its `utils` alias there; keep aliases in sync when files move.
- Theme preference is the `bw_theme` cookie (`light`, `dark`, `system`). `system` means no
  `light`/`dark` class and follows the OS media query, so avoid `dark:` utilities in hand-written
  components and use tokens instead.
- No third-party fonts, scripts, or analytics. Every user-facing string comes from
  `app/lib/i18n/en.ts` through `t()`.
- Radix and sonner set inline `style` attributes for positioning and CSS variables. A strict
  `style-src` cannot nonce them; PR #19 must document an exception or replace them.

## Testing

- Vitest with the Workers pool for server code; Playwright in `e2e/` for flows.
- Test files live in `__test__/` beside the code they cover, named `*.test.ts(x)`.
- Assert observable behavior, not internals.
- Tests never touch the development database and never depend on Internet access.
- Every behavior change ships with a test in the same commit.
- `pnpm test:e2e` starts its own dev server on port 5173 with isolated `.wrangler/e2e` state.
- Auth and vault E2E specs must disable `trace` and `screenshot`: a trace captures cookies and
  typed plaintext. Only the unauthenticated smoke project may keep failure artifacts.

## Crypto and secrets rules for code changes

- All vault encryption happens in `app/lib/crypto/` and runs only in the browser.
- A fresh IV per encryption; never reuse or derive an IV.
- No `Math.random()` in key, IV, recovery-key, backup-code, or password generation.
- Never log, console-print, or serialize plaintext, keys, tokens, or codes.
- New server code that handles secrets belongs in `app/lib/.server/` and must not be imported
  by client modules.

## Workflow

1. Pick the next task in `.agent/tasks.json` with `passes: false` whose dependencies are
   merged. Read its spec in `.agent/tasks/`.
2. Create the branch from its spec (`pullRequest.branch`).
3. Implement only the scope in `pullRequest.scope`; respect `outOfScope`.
4. Add tests for new behavior.
5. Run `/preflight`. Fix blockers before requesting review.
6. Open the PR with the template in `CONTRIBUTING.md`, citing requirement IDs.
7. Only after verification, set the task's `passes` to `true`.

## Project skills

| Skill                    | Use                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `preflight`              | Gate plus parallel review (project rules, security, correctness/a11y, KISS) before every PR |
| `security-review`        | Deeper standalone security review of a diff or module                                       |
| `workers-best-practices` | Cloudflare Worker patterns, bindings, limits                                                |
| `wrangler`               | CLI, configuration, migrations, deploy                                                      |
| `web-perf`               | Bundle and LCP budgets, profiling                                                           |

`/preflight` is mandatory before opening a PR. Its security lens reads
`.agents/skills/preflight/references/security-checklist.md`.

## Git hard rule

Never run `git init`, `add`, `commit`, `branch`, `checkout`, `switch`, `push`, `pull`,
`merge`, `rebase`, `reset`, `stash`, or `gh pr create` unless Alfian explicitly asks for that
specific operation. Show the exact command and the reason, then wait.

## Reporting

- State what you ran and the result. Do not claim a check passed if the script is missing.
- Cite `file:line` for findings.
- Never paste secret values, recovery keys, tokens, real emails, or real ciphertext.
- If a requirement is ambiguous, ask; do not invent scope.
