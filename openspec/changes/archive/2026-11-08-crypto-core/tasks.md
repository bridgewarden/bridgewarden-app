# Tasks

## 1. Contract, encoding, and errors

- [x] 1.1 Create `app/lib/crypto/contract.ts` with the envelope version, algorithm id, HKDF info constants (`bw-auth`, `bw-wrap`, `bw-recovery`), default iteration count, and base64 conventions. Add a comment that these values are permanent. Verify `pnpm typecheck` passes.
- [x] 1.2 Create `app/lib/crypto/encoding.ts` with strict standard-base64 encode/decode and tests covering round-trip, padding, invalid alphabet, and wrong length. Verify the tests pass.
- [x] 1.3 Create `app/lib/crypto/errors.ts` with typed errors for wrong password, invalid recovery key, malformed envelope, and unsupported envelope. Verify tests assert each message names only the category and includes no input value.

## 2. Key derivation

- [x] 2.1 Implement `deriveMasterKey(password, salt, iterations)` with NFKC normalization and PBKDF2-SHA256, plus tests for determinism, composed versus decomposed input, and different iteration counts. Verify the tests pass.
- [x] 2.2 Implement `deriveAuthHash(masterKey)` with HKDF info `bw-auth` and no salt, and `deriveWrapKey(masterKey, kdfSalt)` with info `bw-wrap` and the provided salt. Verify tests show the two outputs differ, are stable for the same input, and match an HKDF reference vector.

## 3. Vault key

- [x] 3.1 Implement `generateVaultKey`, `wrapVaultKey`, and `unwrapVaultKey` with AES-256-GCM and a fresh 12-byte IV. Verify round-trip, wrong-master-key failure, altered ciphertext failure, and different IVs across two wraps.

## 4. Item envelope

- [x] 4.1 Implement `sealItem` and `openItem` with envelope `{ v: 1, alg: 'A256GCM', iv, ct }`, rejecting unknown versions and algorithms. Verify round-trip, altered ciphertext, altered IV, unknown version, and IV uniqueness across repeated seals.

## 5. Recovery key

- [x] 5.1 Implement `generateRecoverySecret`, `formatRecoveryKey`, and `parseRecoveryKey` with 16 random bytes, 26 Crockford base32 characters, separator tolerance, and ambiguous-character mapping. Verify round-trip and rejection of invalid length and alphabet.
- [x] 5.2 Implement `wrapVaultKeyWithRecovery` and `unwrapVaultKeyWithRecovery` using HKDF info `bw-recovery` and no salt. Verify the correct key recovers the vault key, a wrong key fails, and a regenerated recovery key invalidates the old one.

## 6. Known-answer, benchmark, and boundaries

- [x] 6.1 Add known-answer tests using RFC 5869 HKDF-SHA256, HKDF golden values that pin the domain strings, a fixed PBKDF2-SHA256 600k vector, and a fixed AES-256-GCM envelope opened through `openItem`, each with provenance documented next to the constant. Verify the tests pass.
- [x] 6.2 Add a benchmark test that derives a master key at `DEFAULT_KDF_ITERATIONS`, logs the duration, and asserts it stays under the PRD's one-second budget. Verify the test passes and reports the measurement.
- [x] 6.3 Verify the module boundary: no import from `.server`, route, or feature modules, and no call to storage, cookie, network, or console APIs. Verify with a grep over `app/lib/crypto/` and the full unit suite.

## 7. Final verification

- [x] 7.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; confirm every command exits 0 and the crypto tests are included in the run.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Open the PR with change id `crypto-core` and requirements `TASK-13` … `TASK-17`.
- Archive the change after the PR is merged.
