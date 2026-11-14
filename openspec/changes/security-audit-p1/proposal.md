# Proposal

## Why

Security audit run 2 left six source-grounded P1 leads that need code changes. They are independent controls, but they share one release concern: a password manager must not let a client keep deleted secrets, let one member exhaust the shared database, let a second factor be guessed without a cumulative budget, leave vault ciphertext unbound to its row context, expose unauthenticated D1 work, or deploy code against an unexpected schema.

## What Changes

- Add a cumulative per-account second-factor failure budget and cooling-off lockout, separate from the login and step-up counters.
- Make scheduled trash cleanup delta-visible so a client with an older sync watermark cannot retain a deleted secret indefinitely.
- Enforce a per-user vault item/byte quota and an identity-scoped limiter on item creation; return the existing `409 limit` contract.
- Introduce a v2 vault envelope that authenticates row context with AES-GCM AAD while retaining read support for v1 envelopes.
- Bound unauthenticated health and SSR setup-check database work with rate limits, caching, and guard ordering changes.
- Make remote migration application an enforced prerequisite for deploy and add a schema/version canary.

## Capabilities

### New Capabilities

- `availability-guards`: unauthenticated health and SSR setup-check work limits.
- `release-deploy`: deploy and remote-schema compatibility contract.

### Modified Capabilities

- `two-factor-auth`: cumulative second-factor failure accounting and lockout.
- `vault-api`: purge watermark preservation and per-user item storage quotas.
- `vault-crypto`: context-bound envelope v2 with v1 read compatibility; row context must be authenticated.

## Impact

- `app/features/two-factor/.server`, `app/lib/.server/queries/users.ts`, `migrations/` for the cumulative factor lockout.
- `app/server/vault/trash.ts`, `app/server/vault/queries/{items,folders}.ts`, `app/lib/vault/*` for delta-visible cleanup and quotas.
- `app/lib/crypto/envelope.ts`, `app/lib/vault/*`, `app/features/vault-*` for envelope v2 context binding.
- `app/routes/health.tsx`, `app/lib/.server/setup-guard.ts`, `app/routes/protected.tsx`, `workers/app.ts` for availability guards.
- `package.json`, `scripts/`, `README.md`, `openspec/specs/release-deploy` for deploy ordering.
- No UI feature redesign and no new dependency. AAD upgrade requires a migration/compatibility path for existing envelopes.
