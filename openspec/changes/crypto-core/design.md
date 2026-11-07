# Design

## Context

See proposal.md — Why. Current state that shapes the contract:

- `users` already stores `kdf_salt`, `kdf_iterations`, `vault_key_wrapped`, `vault_key_wrap_iv`,
  `recovery_key_wrapped`, `recovery_key_wrap_iv`, `auth_hash`, and `server_salt`.
- There is no `wrap_salt` or `recovery_salt`, and PR #6 already merged the schema.
- `app/lib/crypto/` does not exist; no crypto code or tests exist yet.
- Tests run in the Workers pool, where `crypto.subtle` is available.
- The durable `data-model` spec defines the columns; this change defines their meaning.

## Goals / Non-Goals

**Goals:**

- One permanent key hierarchy shared by setup, login, unlock, password change, and recovery.
- No new schema columns and no server-side decrypt path.
- A versioned envelope that can migrate later without guessing.
- Tests that would fail on IV reuse, tampering, wrong keys, or a changed domain string.

**Non-Goals:**

- Setup, login, recovery, or vault UI; those consume this contract later.
- Server-side pepper verification or session handling.
- IndexedDB cache, item editors, or transport encoding.
- Argon2, WASM, or a third-party crypto library.
- Guaranteed memory zeroization; JavaScript cannot provide it.

## Decisions

### D1. Salt mapping (option A)

```
masterKey      = PBKDF2-SHA256(NFKC(password), kdfSalt, iterations, 32 bytes)
authHash       = HKDF-SHA256(masterKey, salt = empty, info = 'bw-auth', 32 bytes)
wrapKey        = HKDF-SHA256(masterKey, salt = kdfSalt, info = 'bw-wrap', 32 bytes)
recoveryKey    = HKDF-SHA256(recoverySecret, salt = empty, info = 'bw-recovery', 32 bytes)
```

`kdfSalt` is reused at the HKDF Extract step for the wrap key. `masterKey` is already unique per
user because PBKDF2 folded `kdfSalt` in, so this adds no entropy; it adds separation without a
migration. `authHash` and `recoveryKey` use no salt because their inputs are already high-entropy
and `info` separates their domains.

Alternatives rejected: adding `wrap_salt`/`recovery_salt` columns (public salts, no security gain,
schema churn) or deriving a second salt from `kdfSalt` (an extra step with no benefit).

This deliberately overrides the PRD wording (`wrapSalt`, `recoverySalt`) because PR #6 already
shipped the schema and these salts are public. The mapping is part of the permanent contract.

### D2. Password normalization is part of the contract

Normalize with `String.prototype.normalize('NFKC')` before UTF-8 encoding and PBKDF2. This is
permanent: changing it later changes every derived key. It is documented in the contract module and
covered by a test with equivalent composed/decomposed input.

### D3. Base64 for storage, strict decode

All binary values (salts, IVs, wrapped keys, ciphertext) cross the module boundary as standard
base64 with padding. Decoding validates length and alphabet and fails closed. URL-safe transport
encoding belongs to the API PR and converts at the boundary.

### D4. Envelope v1 uses AES-256-GCM without AAD

Plaintext item JSON is UTF-8 encoded and sealed with a 12-byte random IV per call. The envelope is
`{ v: 1, alg: 'A256GCM', iv, ct }`. AAD is omitted so v1 stays simple; binding a context later would
require a new envelope version, which the version field already supports. Unknown `v` or `alg`
throws, and there is no fallback that returns unauthenticated bytes.

### D5. Vault key lifecycle

`vaultKey` is 32 random bytes from `crypto.getRandomValues`, generated once per account. It is
wrapped with `wrapKey` using AES-256-GCM and a fresh 12-byte IV. Unwrap returns bytes only to the
caller. Password change re-wraps the same vault key; item ciphertext is never re-encrypted.

### D6. Recovery key format

`recoverySecret` is 16 random bytes (128 bits). It is displayed as 26 Crockford base32 characters
with grouping separators. Parsing uppercases, strips separators, maps `I`/`L` to `1` and `O` to `0`,
and rejects wrong length or invalid characters. There is no checksum (26 characters is the task's
contract); a wrong key therefore fails at unwrap with a generic authentication error. Regeneration
creates a new secret and wraps the same vault key; the old displayed value no longer unwraps.

### D7. Module layout and surface

| File | Responsibility |
|---|---|
| `contract.ts` | Version, algorithm ids, HKDF info strings, iteration default, base64 conventions |
| `encoding.ts` | `encodeBase64`, `decodeBase64` with strict validation |
| `errors.ts` | `WrongPasswordError`, `InvalidRecoveryKeyError`, `MalformedEnvelopeError`, `UnsupportedEnvelopeError`, `InvalidEncodingError`, `InvalidKdfParamsError`, `InvalidKeyMaterialError`, `InvalidPayloadError` |
| `kdf.ts` | `deriveMasterKey`, `deriveAuthHash`, `deriveWrapKey`, `deriveHkdfBits` (primitive used by recovery and the KAT tests) |
| `vault-key.ts` | `generateVaultKey`, `wrapVaultKey`, `unwrapVaultKey` |
| `envelope.ts` | `sealItem`, `openItem` |
| `recovery.ts` | `generateRecoverySecret`, `formatRecoveryKey`, `parseRecoveryKey`, `wrapVaultKeyWithRecovery`, `unwrapVaultKeyWithRecovery` |

Functions are pure and take explicit inputs (password, salt, iterations, keys); they do not read
env, storage, cookies, or server code.

### D8. Error behavior

Every failure throws a typed error with a fixed message that names only the category. No password,
key, salt, IV, ciphertext, or partial plaintext is attached as a property or included in the
message. Authentication failures from AES-GCM are translated, not rethrown verbatim; decode and
shape failures are raised before the decryption `try` so they stay distinguishable.

The messages are developer-facing categories. A later UI PR maps `error.name` to catalog keys;
the crypto module does not import the copy catalog.

### D9. Tests and benchmark

- Known-answer vectors: RFC 5869 HKDF-SHA256, a fixed PBKDF2-SHA256 600k vector, HKDF golden values
  that pin the three domain strings, and a fixed AES-256-GCM envelope generated with Node/OpenSSL
  and opened through `openItem`; provenance is documented next to each constant.
- Round-trip, wrong password, wrong recovery key, altered ciphertext, altered IV, unknown version,
  and IV uniqueness across repeated seals.
- A benchmark derives a master key at `DEFAULT_KDF_ITERATIONS` and asserts it completes under the
  PRD's one-second budget, logging the measured duration. The suite normally measures ~90ms.
- Tests import only the crypto modules, so no route or server code is pulled in.

### D10. Input validation at the crypto boundary

`deriveMasterKey` rejects non-integer iterations below `MIN_KDF_ITERATIONS` and salts shorter than
16 bytes; `deriveMasterKey`/`deriveWrapKey` require a 32-byte master key; vault, wrap, and envelope
keys must be 32 bytes; the recovery secret must be 16; IVs must be 12; ciphertexts must include at
least the 16-byte tag. Base64 decoding rejects empty and non-canonical strings. Payloads that cannot
be serialized throw `InvalidPayloadError`. These checks stop a malicious server from lowering KDF
cost, supplying a short salt, or smuggling a short key that would silently become AES-128.

## Risks / Trade-offs

- [Permanent domain strings] -> `bw-auth`, `bw-wrap`, `bw-recovery`, NFKC, and base64 conventions
  are exported constants with a comment that changing them invalidates existing vaults.
- [PBKDF2 600k on slow hardware] -> The benchmark records the duration; iterations stay in the user
  row so they can be raised later without changing the contract.
- [Malicious server lowers KDF parameters or shortens key material] -> The client enforces a
  minimum iteration count, a 16-byte salt floor, and exact 32/16/12-byte key and IV lengths.
- [JavaScript cannot zero memory] -> Minimize references and never persist keys; the threat model
  already records this limitation.
- [Recovery key has no checksum] -> Parsing rejects invalid alphabets and a wrong key fails at
  unwrap; users confirm the key during setup.
- [Envelope v1 has no AAD] -> A future context binding ships as v2.
- [Benchmark flake] -> Budget is generous for CI and the measurement is logged for review.

## Migration Plan

- Additive module and tests only; no data migration and no runtime route changes.
- Later PRs call these functions from setup, login, password change, and recovery.
- Rollback: delete `app/lib/crypto/` and its tests; no stored data depends on it yet.
