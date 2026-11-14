# Tasks

## 1. Admin mutation rate limits

- [x] 1.1 Add a shared admin mutation guard that applies IP and actor-identity limits before body/admin work, and use it in invite, role, disable, enable, and revoke-session routes; verify an over-limit request returns `429` with `Retry-After` and leaves state unchanged.
- [x] 1.2 Add route tests for IP rejection, actor rejection, and a successful mutation within both budgets; verify target user/invitation/session state is unchanged on rejection.

## 2. Pending invitation revocation

- [x] 2.1 Expose `revokeInvitation` through `createSetupInvitationQueries` and add an admin route that validates the invitation UUID, requires an admin session, and returns `404` when the conditional update changes no row; verify pending and consumed/unknown cases.
- [x] 2.2 Emit `admin.invitation_revoked` after a successful revoke with actor and `invitationId` metadata only; verify the audit row contains no email, token, or setup link.
- [x] 2.3 Add a revoke action to the pending-invitation card using the existing fetcher flow; verify the invitation disappears from the pending list and its setup link can no longer create a user.
- [x] 2.4 Add admin route/UI tests for successful revoke, unknown invitation, already consumed invitation, and audit payload safety.

## 3. Pending 2FA enrollment TTL

- [x] 3.1 Add a ten-minute pending-enrollment TTL based on `user_2fa.updated_at`; make verification delete or ignore an expired pending row and return `not-pending` without enabling the factor.
- [x] 3.2 Verify restarting enrollment replaces the pending secret and refreshes the window; verify the expired response contains no secret, URI, or backup code.
- [x] 3.3 Add tests for valid-within-window enrollment, expired rejection, restart refresh, and no enablement after expiry.

## 4. Scheduled purge audit

- [x] 4.1 Return affected user ids from the expired item/folder cleanup queries and accumulate one set across batches; verify no ciphertext or item ids cross the audit boundary.
- [x] 4.2 Emit one `vault.purge` audit event per affected user after cleanup, with the user as subject and null metadata; verify empty cleanup emits nothing and audit failure does not fail cleanup.
- [x] 4.3 Add tests for per-user attribution across item/folder batches, deduplication within one run, empty-run silence, and absence of item/folder ids, ciphertext, plaintext, or counts.

## 5. Threat model and deferred coverage

- [x] 5.1 Write `docs/threat-model.md` covering assets, trust boundaries, server-visible fields, mitigations, and non-guarantees; record bearer-session fingerprints as investigative metadata, not an enforced binding, and v1 envelopes as unbound until re-saved.
- [x] 5.2 Link the threat model from `README.md` and the operational runbook; verify the documented non-guarantees match the current session and envelope behavior.
- [x] 5.3 Add regression tests for prelogin known/synthetic KDF responses and logout server-side revocation plus idempotent repeat.
- [x] 5.4 Add regression tests for generator CSPRNG output/preferences and clipboard/reveal timeout plus lock/navigation cleanup.
- [x] 5.5 Record the deferred-audit coverage decision for prelogin, logout, admin throttling, generator, clipboard/reveal, and companion blocks in the threat model or design notes; verify each surface is either tested or explicitly accepted.

## 6. Integration gate

- [x] 6.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and the affected E2E projects; verify no new dependency, UI surface outside admin invitation revoke, or vault plaintext server path.
- [x] 6.2 Run `openspec validate security-audit-p2 --strict` and verify every task is complete before archive.

## Workflow follow-up

- Archive the change after review and a green gate.
- Re-run `openspec validate --all --strict` after archive.
