# Proposal

## Why

The source-and-sandbox security audit confirmed two control failures and several cheap hardening gaps. A session holder can use the 2FA management password re-proof as an unthrottled master-password oracle, and admin audit rows discard the target account. The client also leaves vault-key copies unwiped on hot paths, trusts persisted outbox rows at flush time, and can retain local vault state after a failed logout. Restoring a purged tombstone can create an unreadable live item, and the build emits a plaintext secret copy that deploy removes only with an unchecked shell command.

## What Changes

- Apply IP and identity limits plus dedicated step-up failure accounting/lockout to 2FA enroll/disable/regenerate; a step-up lock must not lock password login. Prefer a one-time step-up token.
- Bump `session_version` and reissue the current session on 2FA state changes.
- Persist caller-supplied audit metadata instead of binding null.
- Add a key-presence API so existence checks cannot leak unzeroed key copies; wipe the previous key on replacement.
- Validate outbox payloads, optimistic/previous rows, and stored entries at flush time with a strict ciphertext schema.
- Wipe local vault state even when the logout request fails.
- Reject restore of a purged item with empty ciphertext.
- Add a hard build-artifact secret check and use it in deploy/CI instead of relying only on `rm -f`.
- Keep CSP/nonce work, session fingerprint enforcement, CI SHA/digest pinning, folder rev-burn, delta cursor uniqueness, and cron rev/audit for separate changes.

## Capabilities

### New Capabilities

- `release-security`: build/deploy artifacts must not contain secret files.

### Modified Capabilities

- `two-factor-auth`: step-up re-proof throttling/lockout and session revocation on factor changes.
- `data-model`: audit metadata must be persisted.
- `vault-client`: key-copy zeroization, outbox validation, logout wipe.
- `vault-api`: restore must reject purged tombstones.

## Impact

- Account 2FA routes/use-cases, rate-limit helpers, session reissue.
- Audit event query binding and tests.
- Client key store, outbox, app shell logout, vault projection callers.
- Vault restore SQL/use-case and tests.
- Deploy script, a new artifact-check script, CI.
- Adds migration `0014_step_up_lockout.sql` for dedicated step-up counters.
