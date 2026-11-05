# Contributing

## Branches

- `main` is the integration branch. Nothing is pushed directly to it.
- One PR per group in `.agent/prd/PR-PLAN.md`.
- Branch names: `feat/<area>-<slice>`, `chore/<slice>`, `test/<slice>`, `docs/<slice>`.
- Branch from the latest merged prerequisite, not from a long-lived feature branch.

## Commits

Conventional Commits, one line, imperative, no trailing period:

```
feat(vault): add login item editor
fix(auth): reject reused TOTP step
chore: initialize repository
```

Allowed types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `build`, `ci`, `security`.

Keep commits focused. Do not mix a refactor with a behavior change.

## Pull requests

Title: `type(scope): summary` — same rules as commits.

Body template:

```markdown
## What changed
One paragraph, no diff restatement.

## Requirement IDs
TASK-13, TASK-14 (from .agent/prd/PRD.md)

## How verified
Commands run and their result, plus manual checks.

## Risk and rollback
What breaks if this is wrong, and how to revert safely.

## Screenshots
Required for UI changes.
```

Rules:

- Cite the PRD requirement IDs that the change implements. A change with no requirement ID is either missing scope or unrequested scope.
- Never include secret values, recovery keys, tokens, real emails, or ciphertext from a real vault in a PR body, screenshot, fixture, or log.
- Run `/preflight` before requesting review. It gates on typecheck, lint, format, tests, and build, then reviews project rules, security, correctness, and complexity.
- Security-sensitive PRs (crypto, auth, headers, session, authorization) need a second reviewer or a completed security checklist in the PR body.
- Do not add phase 2 features (organizations, attachments, import/export, Send, passkeys, email, extension, Android).

## Definition of done

- Typecheck, lint, format check, tests, and build pass.
- New behavior has a test that fails without the change.
- No secret reaches the client bundle, logs, SSR HTML, or the repository.
- Requirement IDs are listed in the PR.
- Any deviation from the PRD is called out and approved in the PR thread.
