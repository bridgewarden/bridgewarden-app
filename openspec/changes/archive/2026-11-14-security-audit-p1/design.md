# Design

## Context

See `proposal.md` and the five spec deltas. The P1 leads come from security audit run 2 at `afe5c64`; P0 already fixed the step-up lockout. The existing controls are source-verified but have four implementation gaps: per-challenge-only 2FA attempts, hard deletion of tombstones without a delta signal, no per-user item quota, unauthenticated D1 work from `/health` and setup guards, and an unsequenced deploy/schema path.

## Goals / Non-Goals

**Goals:**
- Bound 2FA guessing cumulatively without touching the login lockout.
- Make scheduled deletion observable to clients with old sync watermarks.
- Cap per-user item storage and add an identity limiter on create.
- Bind new vault envelopes to their row context while keeping v1 readable.
- Bound unauth health/setup D1 work and avoid duplicate counts for authenticated requests.
- Fail deploy before publishing code against a mismatched schema.

**Non-Goals:**
- New UI, dependencies, or deployment execution.
- Changing the one-key-per-account crypto hierarchy or the login lockout policy.
- Retaining plaintext or weakening zero-knowledge for any new field.
- Full per-worker E2E isolation.

## Decisions

### Cumulative 2FA failure budget

Add migration `0015_two_factor_lockout.sql` with `two_factor_failed_count INTEGER NOT NULL DEFAULT 0` and `two_factor_locked_until INTEGER`. `verifyChallenge` checks the lock before code verification, charges one failure to the account in a guarded UPDATE for TOTP and backup-code failures, and resets the columns on success. Threshold/duration reuse the login constants (10 attempts, 15 minutes) but the columns are independent, so a factor lock never blocks password login. Reset must mirror the step-up fix: restart after an expired lock, verify before recording, and never clear a live deadline from a success that races with another request.

### Delta-visible scheduled cleanup

The cron SHALL stop hard-deleting expired item/folder tombstones. It SHALL erase ciphertext and IV and retain a minimal rev-stamped tombstone row (`deleted_at`, empty `data_ct`/`data_iv`/`name_ct`/`name_iv`) so the existing `rev > since` delta can deliver the deletion. Retention of the metadata row is intentional; the 30-day rule applies to secret material, not to the deletion signal. The same change must ensure purged items remain unrestorable and sync responses still exclude empty-ciphertext rows from normal item views.

### Per-user item quota

Define item quota constants next to the existing folder limits: 5,000 rows and 128 MiB of ciphertext per user. `insertItemStatement` adds a `COUNT(*)`/`SUM(LENGTH(data_ct))` predicate against the session user in the same guarded INSERT; `createVaultItem` returns the existing `limit` result; the route returns `409 {ok:false,error:'limit'}`. Add `limitIdentity('vault', user.id)` to item creation. The quota counts only that user's rows, so D1 growth is bounded independently of source IP.

### Envelope v2 with AAD

Introduce envelope version 2 alongside v1. New seals use AES-256-GCM with additionalData `bw2:item:<id>:<type>` for items and `bw2:folder:<id>` for folders; the envelope includes the version. `openItem` rejects a v2 envelope whose AAD context does not match and falls back to the v1 no-AAD path only for stored v1 rows. All call sites pass the row context; a new save upgrades the row to v2. A valid v2 ciphertext relocated to another item or type fails GCM verification. No plaintext or key material is added to the envelope.

### Availability guards

`/health` charges an IP-scoped limiter before `checkDatabase`; a rejected probe does not touch D1. The setup-guard `users` count is memoized in KV for a short TTL and invalidated after a successful bootstrap. Authenticated protected requests use the memoized configured state instead of a second count. First-run redirects remain unchanged for requests without a session: the cached state still distinguishes `/setup` from `/login`.

### Deploy ordering and canary

`pnpm deploy` runs a new `scripts/check-remote-migrations.ts` before `wrangler deploy`. The script compares local migration names with `wrangler d1 migrations list --remote` and exits non-zero when any local migration is pending. The Worker exposes the expected schema high-water mark in the health payload; the check compares that value with the remote applied set. The runbook records the migration-first order and the rollback floor (do not deploy a pre-0015 Worker while the schema is ahead).

## Risks / Trade-offs

- [AAD v2 breaks existing ciphertext if applied blindly] -> Keep the v1 read path and upgrade only on save; test both versions and relocation rejection.
- [Retained tombstones grow metadata] -> They contain no ciphertext or plaintext; document the small permanent metadata cost and monitor row count.
- [Per-user quota can reject legitimate large vaults] -> Use bounded constants and return the existing `409 limit` contract so the outbox can surface it; no silent data loss.
- [2FA lockout can deny the owner] -> Use the same bounded cooling-off semantics as login/step-up and reset on successful factor proof; recovery remains available.
- [Deploy check requires remote access] -> Deploy already requires Cloudflare authentication; the check fails safe if the command cannot read the remote schema.

## Migration Plan

1. Add `0015_two_factor_lockout.sql`; deploy schema first.
2. Ship quota/purge and availability changes; no destructive migration.
3. Ship envelope v2 with v1 fallback; existing items upgrade lazily on save.
4. Wire the deploy check and canary before the first production deploy.
5. Rollback: keep additive migrations; do not roll back the Worker below the schema high-water mark. Envelope v1 remains readable if the client rolls back, but v2 rows require the new reader.

## Open Questions

- The exact item quota constants can be tuned during apply against the PRD's family-scale target (2,000 items); they are policy values, not protocol values.
