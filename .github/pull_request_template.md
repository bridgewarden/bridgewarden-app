## Summary

<!-- What changed and why, in 1-3 sentences. Do not restate the diff. -->

## Requirement IDs

<!-- Cite requirement IDs from .agent/prd/PRD.md, e.g. TASK-21, TASK-22. -->
<!-- A change with no requirement ID is either missing scope or unrequested scope. -->

- TASK-

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor / structure
- [ ] Tests
- [ ] Documentation / tooling
- [ ] Security / hardening

## What changed

<!-- Bullet the user-visible or architectural changes. Call out deviations from the PRD. -->

-

## Verification

<!-- Mark what actually ran. Do not mark a missing script as pass. -->

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm test` — _**/**_ tests
- [ ] `pnpm test:e2e` — _**/**_ tests
- [ ] `pnpm build`
- [ ] `pnpm exec openspec validate <change> --strict` (planning changes only)

Manual checks:

-

## Security and zero knowledge

<!-- Required for crypto, auth, session, authorization, headers, or vault changes. -->

- [ ] No vault plaintext, master password, vault key, recovery secret, TOTP seed, backup code, token, or auth hash reaches the server, logs, SSR HTML, or storage unsupported by the design.
- [ ] Server authorization is derived from the session, not request bodies or query parameters.
- [ ] New secrets are read from `.dev.vars` / Worker secrets only.
- [ ] No secret values appear in this PR body, fixtures, screenshots, or logs.

If this PR changes the threat model or a zero-knowledge exception, describe it here:

-

## Data and deploy

- [ ] No migration
- [ ] Migration included: `migrations/________.sql`
- [ ] Deploy step required:

## Screenshots / recordings

<!-- Required for UI changes. Never capture vault plaintext or secret material. -->

-

## Risk and rollback

<!-- What breaks if this is wrong, and the safest revert or compensating action. -->

-

## Preflight

- [ ] `/preflight` completed
- [ ] Blockers resolved
- [ ] Remaining warnings explained below

Remaining warnings / accepted trade-offs:

-

## Definition of done

- [ ] New behavior has a test that fails without the change
- [ ] Requirement IDs are listed above
- [ ] No phase-2 feature or non-goal was added
- [ ] Any PRD deviation is called out and approved
