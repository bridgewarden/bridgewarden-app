# Design

## Context

P1 added per-account 2FA login lockout, but 2FA management still leaves a pending enrollment valid indefinitely. Admin mutations are authorized by session and same-origin checks but have no rate limiter. `revokeInvitation` exists in the invitation query module but is not exposed. Scheduled cleanup now advances the vault watermark but has no audit event. See `proposal.md` and the three spec deltas for the required behavior.

## Goals / Non-Goals

**Goals:**

- Bound admin mutation work with the existing Cloudflare rate-limit bindings.
- Make a pending setup invitation revocable without deleting users or adding email flows.
- Expire stale 2FA enrollment state without a migration or new secret.
- Attribute scheduled ciphertext erasure to the affected user in the audit log.
- Record the accepted bearer-session and legacy-envelope trade-offs in the threat model.

**Non-Goals:**

- Enforcing IP or user-agent fingerprint equality on sessions.
- Changing backup-code entropy, recovery semantics, or 2FA login challenge limits.
- Invitation resend, email delivery, new admin roles, or bulk invitation management.
- Auditing every purged row or storing item ids/counts in audit rows.
- Production deployment and release smoke testing.

## Decisions

### One admin mutation guard helper

Add a server helper used by invite, role, disable, enable, revoke-session, and revoke-invitation routes. Order: IP limit, same-origin/JSON parse, `requireAdminApi`, actor identity limit. This fails before mutation work and avoids duplicating policy. Alternative: add limiter calls inline per route; rejected because the route set is growing and error mapping would drift.

Use scope `admin` for both keys, keyed by hashed IP and actor id. The existing bindings define the actual rate. A `429` response reuses `rateLimited` with `Retry-After`; it does not reveal whether the target exists.

### Invitation revocation is a consumed-marker write

Reuse `revokeInvitation` with the admin-selected invitation id and a UUID boundary check. Update only rows with `consumed_at IS NULL`; `changes === 0` maps to `404`. Emit `admin.invitation_revoked` only after a successful update, with actor `userId` and allowlisted `invitationId` metadata. Do not delete the row: the existing invitation listing and accept query already treat a consumed row as invalid, and this avoids a second source of truth.

The admin pending card gets one action using the existing fetcher-based flow; no new page. Alternative: hide pending invitations entirely; rejected because operators need a cleanup action for a leaked or obsolete setup link.

### Pending enrollment TTL uses `user_2fa.updated_at`

Use the existing `updated_at` written by `upsertPendingEnrollment` as the start time. A pending row older than ten minutes is stale: verification deletes it and returns `not-pending`; starting enrollment again replaces the secret and refreshes `updated_at`. No migration is needed.

The existing `2fa-step-up` IP/identity limits remain the attempt budget. A challenge-specific counter would be redundant for a management action that already requires an authenticated session and password proof. Alternative: add `pending_expires_at`; rejected because it duplicates a timestamp already maintained atomically.

### Scheduled purge emits one event per affected user

Change each cleanup batch query to return the selected row ids and `user_id`s before the batch. Accumulate a `Set` of affected users across item and folder batches, then write one `vault.purge` event per user after cleanup. The event subject is the affected `userId`; metadata stays null because the audit allowlist is identifier-only and counts/item ids must not be stored.

Audit failure must not fail cleanup: use `recordAuditEventSafe`, which already swallows insert failures. No event is written for an empty batch. Alternative: one global event; rejected because it cannot attribute the erase during incident review.

### Threat model is documentation, not a behavior change

Add `docs/threat-model.md` covering assets, trust boundaries, server-visible fields, mitigations, and explicit non-guarantees. Record that sessions are bearer tokens whose stored UA/IP fingerprints are investigative metadata, not an enforced binding; comparing them would break legitimate mobile and network changes. Record that legacy v1 envelopes are unbound until re-saved. No `user-auth` or `vault-crypto` requirement changes.

### Deferred audit surfaces get regression coverage

Add focused tests for the prelogin synthetic fallback, logout revocation/idempotence, generator CSPRNG/preferences, and clipboard/reveal cleanup. These surfaces already have controls; the tests close the audit coverage claim rather than adding product behavior. The companion-block sweep is recorded as a review checklist in the change, not a runtime feature.

## Risks / Trade-offs

- [Admin limiter blocks a legitimate batch of role changes] -> Use both IP and actor keys with the deployment-configured binding, return `Retry-After`, and keep the limit scope separate from vault/auth limits.
- [A pending 2FA enrollment expires while the user is scanning] -> Ten minutes is enough for QR setup; restarting enrollment refreshes it, and the response remains secret-free.
- [Purge audit volume grows with affected users] -> One event per user per cleanup run, not per row or batch; no metadata body.
- [Threat model drifts from code] -> Link it from README/runbook and review it with the same change that changes server-visible fields.
- [Invitation revoke races with setup completion] -> Both paths condition on `consumed_at IS NULL`; one update wins and the other returns `404`/not-pending.

## Migration Plan

No D1 migration. Deploy only the Worker and run the usual full gate. Rollback is safe: old Workers ignore the new audit event and TTL behavior; invitation revocation only changes `consumed_at` on pending rows. No secret rotation or data backfill is required.

## Open Questions

None.
