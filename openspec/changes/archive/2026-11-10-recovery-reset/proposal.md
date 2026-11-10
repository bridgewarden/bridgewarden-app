# Proposal

## Why

Users who lose their master password currently have no way back into their vault. The recovery key already wraps the same vault key, but the server has no way to verify that a reset request actually possesses that key. TASK-27 requires a reset flow that proves recovery-key possession, forces a new master password, burns the old recovery key, and revokes every session.

## What Changes

- Add a new recovery-proof derivation domain `bw-recovery-auth` so setup and member setup can store a verifier without ever sending the recovery secret or its wrap key to the server.
- Add `recovery_auth_hash` and `recovery_server_salt` to `users` through a forward-only migration. Existing rows remain `NULL`; their recovery reset is unavailable until a recovery key is regenerated.
- Add `GET /recover` with email lookup, recovery-key entry, forced new master password, and one-time display of the new recovery key.
- Add rate-limited lookup and reset endpoints. Lookup returns a uniform wrapper/IV shape for known and unknown emails; unknown emails receive deterministic synthetic material.
- On reset, verify the old recovery proof with constant-time comparison, then apply one guarded update covering auth hash, KDF parameters, vault wrapper, recovery wrapper, recovery proof, and `session_version + 1`.
- Revoke every previous session, issue a new session for the resetting device, and record payload-free audit events for failure and success.
- Preserve vault item ciphertext: the same vault key is unwrapped with the recovery key and re-wrapped under the new master key.
- **BREAKING for pre-migration accounts:** recovery reset is unavailable until a recovery key is regenerated. There is no email recovery or escrow fallback.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-auth`: add recovery-key lookup, proof verification, forced password reset, session revocation, and recovery audit requirements.
- `account-bootstrap`: setup and member setup must derive and persist the recovery proof with the existing recovery wrapper.
- `data-model`: user rows must carry nullable recovery auth hash and recovery server salt fields.

## Impact

- New migration `migrations/0010_recovery_auth.sql`.
- New routes `recover`, `auth/recover/lookup`, and `auth/recover/reset`; `app/routes.ts` update.
- New feature `app/features/recover/` with client flow components and hooks.
- Crypto contract addition `HKDF_INFO.recoveryAuth`, setup-key derivation, and a recovery-reset client helper.
- User query changes for lookup and guarded rotation; setup and member setup payload changes.
- New i18n strings, route and crypto tests, and an E2E recovery flow.
- No vault item re-encryption, no email delivery, no key escrow, no auto-lock (TASK-28 remains deferred until the encrypted vault cache lands).
