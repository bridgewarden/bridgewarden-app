# Proposal

## Why

There is no client-side crypto module yet, while the schema already stores `kdf_salt`,
`vault_key_wrapped`, `recovery_key_wrapped`, and `auth_hash`. Setup, login, unlock, password change,
and recovery all depend on one permanent key-derivation and envelope contract. Choosing it now,
before any real user exists, is the only time it can be changed without breaking vaults.

## What Changes

- Add `app/lib/crypto/` with a versioned contract, strict base64 helpers, typed errors, and no
  server imports.
- Master key: NFKC-normalized password → PBKDF2-SHA256 at the stored iteration count (default
  600000) → 32-byte `masterKey`.
- `authHash`: HKDF-SHA256 with info `bw-auth`, no salt. The server adds its own pepper later.
- Vault key: 32 random bytes, wrapped with AES-256-GCM under a wrap key derived from `masterKey`
  with HKDF info `bw-wrap` and the existing `kdfSalt`. No new salt column.
- Item envelope v1: `{ v: 1, alg: 'A256GCM', iv, ct }` with a fresh random 96-bit IV per encryption
  and explicit rejection of unknown versions.
- Recovery key: 128 random bits shown as 26 Crockford base32 characters, wrapped over the same
  `vaultKey` with HKDF info `bw-recovery` and no salt.
- Tests: known-answer vectors for PBKDF2/HKDF/AES-GCM, round-trips, tamper rejection, wrong
  password and wrong recovery key, IV uniqueness, unsupported versions, and an unlock benchmark.
- No UI, routes, storage writes, or server code.

The salt decision is deliberate: `masterKey` and `recoverySecret` are already high-entropy, so HKDF
`info` provides domain separation; reusing `kdfSalt` for the wrap key avoids changing the schema.

## Capabilities

### New Capabilities

- `vault-crypto`: the permanent client-side key hierarchy, envelope format, recovery key, and the
  rules that keep key material out of storage and logs.

### Modified Capabilities

None.

## Impact

- New files under `app/lib/crypto/` and tests under `app/lib/crypto/__test__/`.
- No schema, route, Worker binding, or dependency changes; WebCrypto is the only primitive.
- Setup, login, password change, recovery, and vault item I/O consume this contract in later PRs.
