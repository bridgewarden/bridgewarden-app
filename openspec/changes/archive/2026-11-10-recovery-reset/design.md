# Design

## Context

See `proposal.md` - Why. The current user row already stores `recovery_key_wrapped` and `recovery_key_wrap_iv`, and recovery crypto already unwraps that wrapper with a 128-bit Crockford recovery key. What is missing is a server-verifiable proof of possession and a reset transaction. The schema is forward-only D1, has no interactive transactions, and uses guarded single-statement updates plus `db.batch()` for multi-statement writes.

The existing session contract increments `session_version` to revoke all sessions and creates a replacement session for the acting device. The password-change flow already demonstrates the rotate-and-reissue pattern this flow should reuse.

## Goals / Non-Goals

**Goals:**

- Verify recovery-key possession without sending the recovery secret or its wrap key.
- Keep lookup responses indistinguishable for known and unknown emails.
- Apply the reset as one guarded, all-or-nothing credential replacement.
- Leave vault item ciphertext untouched and burn the old recovery key.
- Reuse the existing rate-limit, audit, session, and cookie contracts.

**Non-Goals:**

- Email delivery, account enumeration recovery, escrow, or support-assisted reset.
- Auto-lock or local re-unlock (`TASK-28` waits for the encrypted vault cache).
- Regenerating recovery keys for pre-migration accounts.
- Re-encrypting vault items.

## Decisions

### Separate recovery-auth HKDF domain

Add `HKDF_INFO.recoveryAuth = 'bw-recovery-auth'`. The client derives a 32-byte proof from the recovery secret and sends only that proof. The server stores `HMAC-SHA256(AUTH_PEPPER, proof || recoveryServerSalt)` and the random server salt, mirroring the master auth verifier.

Why not reuse `bw-recovery`: that output is the AES wrap key. Sending or storing it would let a database or request leak unwrap the vault. Why not hash the recovery secret directly on the server: the server must never receive the secret, and a fast hash of a high-entropy key is still a bearer verifier that should be pepper-protected.

### Nullable verifier columns with no backfill

Migration `0010_recovery_auth.sql` adds `recovery_auth_hash TEXT` and `recovery_server_salt TEXT` as nullable. New accounts write both. Legacy rows remain `NULL` and receive the generic recovery failure; there is no dummy proof, because a dummy would advertise a recovery path that cannot work. This is the accepted option 1 from exploration. A future settings flow can regenerate the recovery key and populate both fields.

### Deterministic synthetic lookup material

`POST /auth/recover/lookup` returns only `recoveryKeyWrapped` and `recoveryKeyWrapIv`. For a known active account it returns the stored wrapper/IV. For an unknown or disabled account it returns deterministic synthetic values derived from `HMAC(AUTH_PEPPER, 'recovery-lookup:' + email)`: 48 bytes for the wrapped value and 12 bytes for the IV, encoded as base64url. The same email therefore produces the same shape and bytes on every request, while the client cannot distinguish the response without a valid recovery key.

Why not return a synthetic KDF response: recovery does not need KDF parameters, and returning them would leak a different shape from the known path. Why not random synthetic bytes: repeated requests would reveal stability for real accounts. Lookup is rate-limited by IP and email identity and never writes audit events containing the email.

### Reset is one guarded statement

`POST /auth/recover/reset` accepts the old recovery proof, new master auth material, new KDF parameters, new vault wrapper, new recovery wrapper, and new recovery proof. It verifies the old proof against `recovery_auth_hash`/`recovery_server_salt` with constant-time comparison, then performs:

```sql
UPDATE users
SET auth_hash = ?, server_salt = ?, kdf_alg = 'pbkdf2-sha256',
    kdf_salt = ?, kdf_iterations = ?, vault_key_wrapped = ?, vault_key_wrap_iv = ?,
    recovery_key_wrapped = ?, recovery_key_wrap_iv = ?,
    recovery_auth_hash = ?, recovery_server_salt = ?,
    session_version = session_version + 1,
    failed_login_count = 0, locked_until = NULL, updated_at = ?
WHERE id = ? AND status = 'active'
  AND recovery_auth_hash = ? AND recovery_server_salt = ?
```

The update is conditional on both the account id and the exact verifier snapshot that was checked. A concurrent reset using the pre-reset verifier changes zero rows and returns the generic failure. Because D1 cannot combine this with session creation, the session is created after a successful update; if session creation fails, the response is a server error and the user must sign in with the new password. The new password is already committed.

### No login lockout for recovery failures

Recovery proof failures are rate-limited but do not increment `failed_login_count` or set `locked_until`. The proof has 128 bits of entropy, so guessing is infeasible, and account lockout on an unauthenticated reset would let anyone deny recovery to the owner. Failed attempts still emit a payload-free audit event. The account's login lockout is reset on successful recovery because the credential is new.

### Client derives, server verifies, client re-wraps

The browser flow is:

1. lookup by email and receive wrapper/IV;
2. parse the recovery key, derive the recovery wrap key and recovery auth proof;
3. unwrap the vault key; a wrong key fails with a generic message;
4. force a new master password and derive new auth/wrap material;
5. regenerate the recovery secret and derive both its wrapper and proof;
6. submit only the old proof, new auth material, wrappers, and new proof;
7. on success, hold the vault key in memory, display the new recovery key once, and continue to `/app`.

The recovery secret and vault key never leave the browser. All generated buffers are cleared on every exit path.

### Reuse existing session and audit contracts

The reset is unauthenticated, so it issues a new session through `createSession` with the incremented version and peppered UA/IP hashes. Any stale cookie is irrelevant because the old version is rejected. Audit events are `recovery.failed` and `recovery.completed`, with fingerprints only. If the row update committed but session creation fails, the route returns `{ok: true, sessionIssued: false}`; the UI still shows the new recovery key once and directs the user to sign in with the new password instead of claiming the reset failed.

The recovery key is an intentional break-glass credential: a successful reset issues a session without a TOTP challenge. When the account has 2FA enabled, the server also records `recovery.completed_2fa_bypassed` so the bypass is auditable. This matches the recovery-key threat model: possession of the key already implies the ability to unwrap the vault, and requiring a lost authenticator would make disaster recovery impossible.

## Risks / Trade-offs

- **Legacy accounts cannot recover** -> explicit accepted limitation; UI returns the generic failure and documentation names recovery-key regeneration as the remedy.
- **Lookup exposes wrapper ciphertext** -> wrapper is encrypted with a 128-bit recovery key and cannot be used without it; the response contains no KDF/master/auth material.
- **Recovery proof becomes a bearer credential if leaked** -> it is sent only over TLS, never logged, and separated from the wrap key; the same rule already applies to the master auth hash.
- **D1 update succeeds and session creation fails** -> return a server error telling the user to sign in with the new password; never claim the reset failed when the row committed.
- **Concurrent reset** -> CAS on the old verifier makes exactly one request win; the loser gets the generic failure.
- **Synthetic lookup values accidentally match a real wrapper** -> both are valid base64url lengths; the probability of a usable collision is cryptographically negligible.
- **Recovery attempts can be used for CPU work** -> both endpoints are rate-limited before proof verification; the identity bucket includes the request IP so one attacker cannot exhaust a victim's bucket.
- **Leaked recovery key bypasses 2FA** -> accepted break-glass trade-off, documented in README, and marked with a dedicated audit event.

## Migration Plan

1. Add migration `0010_recovery_auth.sql` with nullable columns; apply locally and in CI migration tests.
2. Deploy application code that writes verifiers for new accounts and tolerates null values for old accounts.
3. Existing accounts keep password login and password rotation. Recovery reset stays unavailable until a recovery key is regenerated by a future flow.
4. Rollback the application code first; the nullable columns are harmless if left in place. Do not drop columns in a forward-only migration.
5. Verify with a fresh setup account: lookup, recover with the original recovery key, old key fails, old session revoked, new session works, and password login with the new password succeeds.

## Open Questions

None. The legacy-account behavior and no-lockout decision are resolved above.
