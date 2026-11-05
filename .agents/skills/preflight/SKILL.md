---
name: preflight
description: Review a branch before a pull request. Runs the typecheck/lint/format/test/build gate first, then dispatches parallel read-only reviewers (project rules, security, correctness and accessibility, KISS/YAGNI), verifies every finding against the code, and reports a deduplicated severity list.
argument-hint: '[base-branch]'
---

# Preflight

Use before opening or updating a pull request, or when asked to review the current branch.

This skill never runs git state changes and never pushes. Show a `git` command and wait for
explicit permission instead of running it.

## 1. Gate first

Run the deterministic checks. If any fails, report the failure and **stop** — do not spend
reviewers on code that does not pass its own gate.

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

Add `pnpm test:e2e` when the change touches auth, vault flows, or routing.

Record pass/fail per command with actual counts. A missing script, a tool that is not
installed yet (before PR 01 lands), zero discovered tests, or a skipped check is **not** a
pass — report it as a blocker with the reason.

## 2. Define the review scope

Scope is the branch diff against its base:

- Default base: `main`. If an argument was given, use that.
- Review changed code first, then expand to callers only to prove a claim.
- Review the working tree as committed; do not sweep unrelated dirty files into findings.

Without permission to run git, ask for the diff or read the changed files directly.

Requirement IDs from `.agent/prd/PRD.md` and the PR's stated `requirementIds` define intent.
A change that does not map to a requirement is either missing scope or unrequested scope —
flag it.

## 3. Parallel reviewers

Dispatch 2–4 subagents **in one message** so they run concurrently. Use the read-only
`explore` agent. Each prompt must be self-contained: scope, the files or diff to read, the
lens, and the required output format. Reviewers do not edit and do not talk to each other.

**Lens A — project rules.** Read `AGENTS.md` first, then check the changed files against it:
routes declared in `app/routes.ts`, data through `loader`/`action`, vault data through
`clientLoader` or client-side fetch after unlock, no `fetch` in components, thin route
modules, file naming, feature placement, TypeScript strictness (no `any`), import order, and
one-line Conventional Commits.

**Lens B — security.** This is the mandatory extra lens for this project. Read
`${COMMANDCODE_SKILL_DIR}/references/security-checklist.md` and check the diff against it.
Focus on zero-knowledge invariants (no vault plaintext or key material reaching the server,
logs, SSR HTML, or storage), crypto misuse, authorization, secret handling, XSS/CSP, and
input limits. Report only violations introduced or made reachable by this change.

**Lens C — correctness at the edges.** Accessibility and tests: real controls instead of
clickable divs, accessible names, `aria-invalid` with visible errors, focus trap and restore,
loading/empty/error/offline states, error boundaries, colocated tests for behavior changes,
tests asserting observable behavior rather than internals.

**Lens D — KISS/YAGNI.** Complexity the requirement does not justify: unused config,
single-caller abstractions, duplicate sources of truth, state that a loader or derived render
already covers, new dependencies for something the Web platform or the stack already
provides. Type safety, validation at real boundaries, and meaningful tests are not
complexity.

Skip a lens when the diff cannot touch it, and say which lenses ran.

## 4. Verify every finding

For each candidate finding, reopen the cited lines and confirm three things:

1. the line still exists in the reviewed revision
2. it actually violates the quoted rule, not just this project's preference
3. the proposed fix preserves the intended behavior and the crypto contract

Drop anything you cannot prove, and merge duplicates. A reviewer opinion without a
`file:line` is not a finding. Security findings additionally require a concrete attack path
or misuse scenario; "could be unsafe" is not a finding.

## 5. Report

```markdown
## Gate

typecheck pass · lint pass · format pass · test 12/12 pass · build pass

## Blockers

- app/routes/api.vault.tsx:42 — [SECURITY/HIGH] `user_id` read from request body — scope by session user
- app/lib/crypto/envelope.ts:88 — [SECURITY/CRITICAL] IV reused across saves — generate per encryption

## Warnings

- ...

## Notes

- ...

## Reviewed

commit <sha>, <n> files, lenses A/B/C/D
```

Security findings carry a `[SECURITY/<severity>]` tag. Order blockers by severity
(CRITICAL → HIGH → MEDIUM → LOW), then correctness blockers.

Report only what changed or what the change breaks. Do not restate the diff, do not flag
pre-existing debt in untouched code, and do not claim the branch is secure or correct.
