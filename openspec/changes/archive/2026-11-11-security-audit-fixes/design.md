# Design

## Context

See `proposal.md` - Why. The audit confirmed a medium unthrottled 2FA step-up and a low audit-metadata loss. It also verified cheap hardening gaps in vault-key handling, outbox validation, logout cleanup, restore semantics, and build artifacts. The server remains zero-knowledge; none of these fixes touch vault plaintext transport or the crypto contract.

## Goals / Non-Goals

**Goals:**

- Make 2FA password re-proof as resistant as password change.
- Preserve admin audit target attribution.
- Remove unzeroed key copies and validate outbox ciphertext at every boundary.
- Wipe local vault state even if logout fails.
- Prevent restore of purged tombstones.
- Make build/deploy fail closed on secret-bearing artifacts.

**Non-Goals:**

- CSP/nonce work (TASK-48).
- Session fingerprint enforcement and cookie prefix changes.
- CI action SHA/digest pinning and release-age policy.
- Folder rev-burn, delta cursor uniqueness, cron rev/audit.
- New database migration.
- A one-time step-up token service; rate limiting/lockout is the smallest fix here.

## Decisions

### 2FA step-up protection

All three management use-cases (`enroll`, `disable`, `regenerate`) share a helper that:

1. reads the current `auth_hash`, `server_salt`, `status`, and `locked_until`;
2. returns `locked` with `Retry-After` when the dedicated step-up lock is active;
3. verifies the submitted `authHash`;
4. atomically reserves one step-up attempt before verification (so a concurrent burst cannot exceed the budget), audits `2fa.step_up_failed` on failure, and returns `invalid-password` or `locked`;
5. on success resets the dedicated step-up counter.

Routes call `limitIp('2fa-step-up')` before body parsing and `limitIdentity('2fa-step-up', user.email)` after authentication. Responses: 429 rate-limited, 423 locked, 400 invalid, matching password change semantics.

The disable, regenerate, and enrollment-verify use-cases bump `session_version`, create a replacement session for the current user, and return its cookie. If session creation fails, the route returns `sessionIssued:false`; the factor change is committed but other sessions are invalidated, and the user signs in again.

### Audit metadata

Bind `event.metadata ?? null` in `insertAuditEvent`. Keep the insert secret-free; callers only send non-sensitive identifiers. Add tests that targetUserId and invitationId survive and that no credential fields are accepted.

### Vault-key boundaries

Add `hasVaultKey(): boolean` and use it for the sync/outbox existence checks. `setVaultKey` wipes the previous buffer before assigning the copy. Keep `getVaultKey()` copy-on-read for consumers that need bytes; those consumers must wipe in `finally`. Add a static test/lint note that raw existence checks use `hasVaultKey`.

### Outbox strict validation

Define Zod schemas for each outbox payload kind and for `CachedItem` / `CachedFolder`. Validate:

- on enqueue: payload, optimistic row, previous row;
- on flush: each stored entry again before `requestFor`.

An invalid entry is rolled back, removed, and emitted as `error`; it never reaches `fetch`. Keep standard-base64 cache and base64url transport conversion unchanged.

### Logout failure

The logout effect always calls `lockVault()` and starts `wipeVaultDb()` before/independent of the server response. On success, navigate to login. On failure, keep the locked overlay, show the generic error, and let the user retry sign-out. Local ciphertext/key material must not survive a failed attempt.

### Restore purged tombstone

Add `data_ct <> '' AND data_iv <> ''` to the restore statement's predicate. A purged row returns not-found/conflict and remains a tombstone.

### Build artifact secret gate

Add `scripts/strip-build-secrets.ts`:

- recursively scan `build/` for basenames `.dev.vars`, `.env`, `.env.local`, `.env.*`;
- delete matches;
- rescan and exit non-zero if any remain or if scanning fails.

Change `build` to `react-router build && node scripts/strip-build-secrets.ts`. Change `deploy` to `pnpm build && wrangler deploy`; remove the unchecked `rm -f`. CI already runs `pnpm build`, so it exercises the gate. `preview` runs the gate, then copies the local `.dev.vars` into `build/server` only for local preview. Add a unit test that creates a temporary fake build tree and asserts deletion/failure behavior.

## Risks / Trade-offs

- **2FA session reissue** -> a KV failure after the factor change leaves no cookie; return `sessionIssued:false` and require login. The committed change is authoritative.
- **Rate limits** -> use a new `2fa-step-up` bucket and dedicated `step_up_failed_count`/`step_up_locked_until` columns so a step-up lock cannot deny password login.
- **Strict outbox schema** -> older queued entries with extra fields fail closed and are dropped with an error; this is preferable to sending unvalidated data.
- **Build stripping** -> deploy/preview must always build through the npm script; direct `react-router build` bypasses the gate and is documented as unsupported.
- **Restore guard** -> a purged item is permanently unrestorable, matching purge semantics.
- **No CSP/session binding in this change** -> those remain separate hardening work.

## Migration Plan

1. Add migration `0014_step_up_lockout.sql` with dedicated counters.
2. Add 2FA step-up helper and route limits/lockout; add session reissue.
2. Fix audit metadata and add attribution tests.
3. Add `hasVaultKey`, wipe previous key, update outbox/sync.
4. Add strict outbox schemas and flush-time validation.
5. Change logout cleanup, restore predicate, and build script/gate.
6. Run unit, route, build, and focused sandbox probes; then E2E.

## Open Questions

None.
