# Proposal

## Why

P1 closed every `needs_validation` lead from audit run 2. The remaining risk is concentrated in administrative mutation availability, stale 2FA enrollment state, and scheduled purge observability. These are lower-severity hardening gaps, not new product scope.

## What Changes

- Add IP and actor-scoped rate limits to every admin mutation endpoint.
- Expose revocation of a pending setup invitation using the existing token-hash lifecycle, with an audit event.
- Expire a pending 2FA enrollment after a short TTL while preserving the existing step-up and identity limits.
- Emit a per-user audit event when scheduled trash cleanup erases ciphertext, without item ids, ciphertext, or plaintext.
- Add a threat model that records the accepted bearer-session trade-off and the v1 envelope compatibility limit.
- Add regression tests for the deferred audit surfaces: prelogin synthetic fallback, logout idempotence, generator randomness/preferences, and clipboard/reveal cleanup.

Out of scope: enforcing session fingerprint comparison, changing the backup-code entropy, exposing invitation resend, adding new admin roles, production deployment, and any phase-2 feature.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-users`: admin mutations gain rate limits; pending setup invitations gain an audited revoke path.
- `two-factor-auth`: pending enrollment expires after a bounded TTL and cannot be resumed indefinitely.
- `release-observability`: scheduled cleanup emits a redacted per-user audit event.

## Impact

- `app/routes/admin.users.*`, `app/features/admin-users/.server`, `app/lib/.server/queries/setup-invitations.ts`, admin UI pending card.
- `app/features/two-factor/.server/use-cases/{enroll,verify-enrollment}.ts`, `app/lib/.server/queries/user-two-factor.ts`.
- `app/server/vault/trash.ts`, `app/server/vault/queries/{items,folders}.ts`, audit event tests.
- `docs/threat-model.md`, README/runbook references.
- Tests for admin routes, 2FA enrollment, scheduled purge, prelogin, logout, generator, and clipboard/reveal.
- No new dependency, no schema migration expected, and no vault plaintext or key material in server paths.
