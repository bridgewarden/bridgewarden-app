# Proposal

## Why

Users can create an account but cannot rotate the master password. Because vault items are encrypted under a long-lived vault key, rotating the password should only re-wrap that key, not re-encrypt the vault. TASK-26 requires this O(1) rotation with immediate revocation of every other session.

## What Changes

- Add `POST /api/account/password` requiring a valid session and proof of the current password.
- Accept only derived transport material: current auth hash, new auth hash, new KDF salt/iterations, and the re-wrapped vault key plus IV.
- Verify `currentAuthHash` against the stored server auth hash, then update the user row in one atomic statement.
- Increment `session_version`, invalidate every other session, and reissue a session cookie for the current device.
- Build a change-password form in `/app/settings`:
  - current password, new password, confirmation;
  - client derives the current master key, unwraps the vault key, derives new KDF/wrap/auth material, and re-wraps the same vault key;
  - the vault key remains in memory and item ciphertext is untouched.
- Expose the authenticated user's current public KDF parameters to the settings loader so the browser can derive the current master key without a prelogin round trip.
- Keep the existing recovery key valid; password rotation changes only the password wrapper and server auth hash.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-auth`: adds authenticated master-password rotation, atomic user-row update, and session revocation while preserving the current session.

## Impact

- New route `app/routes/api-account-password.ts` and parser.
- New user query operation for password rotation and KDF parameter loading.
- New client crypto helper for password rewrap.
- Changes to `app/features/account-settings/` and its loader data.
- No migration, no vault item re-encryption, no recovery-key change.
- Unit, route, and E2E coverage for old-password failure, new-password login, and other-session revocation.
