# Design

## Context

See `proposal.md` — Why. Existing pieces:

- `deriveMasterKey`, `deriveAuthHash`, `deriveWrapKey`, `unwrapVaultKey`, and `wrapVaultKey` live in `app/lib/crypto/`.
- `users` stores `auth_hash`, `server_salt`, KDF parameters, wrapped vault key/IV, and `session_version`.
- `verifyServerAuthHash` validates a client auth hash with the stored server salt and pepper.
- `createSession`/`destroySessionToken` own KV sessions; `session_version` is authoritative revocation state.
- Account settings currently loads only 2FA state.

## Goals / Non-Goals

**Goals:**

- Rotate the password without touching vault ciphertext or the recovery key.
- Prove the current password server-side without receiving it.
- Revoke every other session and keep the current device signed in.
- Fail closed with no partial credential update.

**Non-Goals:**

- Recovery reset (`TASK-27`).
- Auto-lock (`TASK-28`).
- Recovery-key regeneration.
- Item re-encryption or vault-key rotation.

## Decisions

### D1. One JSON endpoint with derived material only

`POST /api/account/password` accepts:

```ts
{
  currentAuthHash: string; // base64url, 32 bytes
  authHash: string;        // base64url, 32 bytes
  kdfSalt: string;         // base64url, 16 bytes
  kdfIterations: number;   // >= 600_000
  vaultKeyWrapped: string; // base64url, 32 + 16 tag bytes
  vaultKeyWrapIv: string;  // base64url, 12 bytes
}
```

A strict Zod parser plus the existing decode helpers validate sizes before use. No password, vault key, recovery secret, or extra fields are accepted.

### D2. Current password proof

The route resolves the session user, loads `auth_hash`, `server_salt`, and `status`, then calls `verifyServerAuthHash(currentAuthHashBytes, serverSalt, pepper, storedAuthHash)`.

- Wrong proof and missing account both return the same 401 body.
- Disabled accounts fail closed.
- The new auth hash is not compared to anything; it will become the stored hash.

### D3. One atomic update

`createUsersQueries(env).rotatePassword(...)` performs one guarded SQL statement:

```sql
UPDATE users
SET auth_hash = ?, server_salt = ?, kdf_alg = 'pbkdf2-sha256',
    kdf_iterations = ?, kdf_salt = ?,
    vault_key_wrapped = ?, vault_key_wrap_iv = ?,
    session_version = session_version + 1,
    failed_login_count = 0, locked_until = NULL,
    updated_at = ?
WHERE id = ? AND status = 'active'
```

The new server salt and hashes are computed before the write. If the statement changes zero rows, nothing is updated. Recovery wrapper columns are untouched.

### D4. Current-session reissue

After the update, the route reads the new `session_version` and creates a replacement KV session with that version. It deletes the old session token and returns the new cookie.

D1 and KV cannot share a transaction. If KV creation fails after the D1 update, the old session is already invalidated; the user must sign in again with the new password. The route returns `server-error` and does not claim success.

### D5. Client rewrap

The settings loader returns the authenticated user's current public KDF parameters (`kdfSalt`, `kdfIterations`) and email. The wrapped vault key is **not** in the loader: `POST /api/account/password/prepare` verifies the current auth hash behind the same rate limit/lockout before returning the wrapper material. The form derives:

```text
current masterKey -> current wrapKey -> unwrap vaultKey
new masterKey' -> new authHash' + new wrapKey' -> wrap same vaultKey
new server auth hash = HMAC pepper is server-side; client sends authHash'
```

The in-memory vault key is replaced with the same bytes and zeroed copies are wiped. The form clears all password fields and derived keys after submission.

`app/lib/crypto/password-change.ts` owns this flow and is unit-tested with known material.

### D6. Settings integration

Add a password card to `features/account-settings`:
- current password, new password, confirmation;
- errors for missing fields, mismatch, wrong current password, network failure;
- busy state and live status;
- no recovery-key fields.

The existing 2FA card remains independent.

## Risks / Trade-offs

- [Wrong current password reveals account existence] → the endpoint is authenticated; the session already proves account access.
- [D1 succeeds but KV reissue fails] → user is logged out but password is correctly changed; document the compensating outcome.
- [Recovery key wrapper left unchanged] → intentional; the existing recovery key remains valid, and rotation of recovery is a separate operation.
- [KDF parameters exposed in loader] → public by design and already returned by prelogin.
- [Client derives wrong bytes] → strict length validation and round-trip crypto tests reject malformed material.
- [Session version bump races another tab] → authoritative D1 version rejects the stale session; the current tab receives the new cookie.

## Migration Plan

No schema change. Deploy code and UI. Rollback is a code revert; users who already rotated keep their new password and can continue to sign in.
