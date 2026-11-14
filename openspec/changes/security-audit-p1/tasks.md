# Tasks

## 1. Cumulative 2FA failure budget

- [x] 1.1 Add migration `0015_two_factor_lockout.sql` with independent per-account factor failure and lock columns.
- [x] 1.2 Add guarded query functions to check, record, and reset the cumulative factor budget; verify a live lock rejects before code verification and an expired lock restarts at one.
- [x] 1.3 Charge TOTP and backup-code failures to the cumulative budget in `verify-challenge`, reset on success, and keep the password-login lockout untouched.
- [x] 1.4 Add regression tests for challenge rotation, threshold lock, cooling-off recovery, and login independence.

## 2. Delta-visible cleanup and item quota

- [x] 2.1 Change scheduled cleanup to blank ciphertext/IV and retain a rev-stamped tombstone instead of hard-deleting the row; verify an old `since` still receives the deletion.
- [x] 2.2 Add per-user item-count and ciphertext-byte quota predicates to the atomic item insert; verify over-quota returns `409 limit`, does not consume a revision, and is not bypassed by changing source address.
- [x] 2.3 Add an identity-scoped limiter to item creation and verify quota/limiter behavior for one member.
- [x] 2.4 Add tests for purge watermark convergence, empty-ciphertext tombstones remaining non-restorable, and quota boundaries.

## 3. Envelope v2 context binding

- [x] 3.1 Add v2 envelope constants and context-aware seal/open functions for item and folder rows while retaining v1 read support.
- [x] 3.2 Pass row context at every seal/open call site and upgrade a v1 row to v2 on save.
- [x] 3.3 Add tests that a relocated v2 ciphertext fails authentication, a v1 envelope still decrypts, and a re-save produces v2.
- [x] 3.4 Verify no plaintext or key material enters the new AAD or envelope fields.

## 4. Availability guards

- [x] 4.1 Add an IP-scoped limiter to `/health` and verify rejected probes do not execute the D1 query.
- [x] 4.2 Memoize the setup `users` count with invalidation on bootstrap and reuse it for authenticated protected requests.
- [x] 4.3 Add tests for repeated health probes, configured-state invalidation, and first-run redirect behavior.

## 5. Deploy ordering and schema canary

- [x] 5.1 Add the remote migration check script and wire it before `wrangler deploy`.
- [x] 5.2 Expose the expected schema high-water mark in the health payload and compare it with the remote migration set.
- [x] 5.3 Document migration-first deploy, rollback floor, and canary use in the README/runbook.
- [x] 5.4 Add tests for pending-migration rejection and matching/unmatching schema canaries using local fakes.

## 6. Integration gate

- [x] 6.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and the affected E2E projects.
- [x] 6.2 Verify no new dependency, UI surface, or plaintext server path; record any AAD migration compatibility limits.
- [x] 6.3 Confirm the P1 audit leads are either fixed or explicitly documented as accepted policy.

## Workflow follow-up

- Archive the change after review and a green gate.
- Re-run `openspec validate --all --strict` after archive.
