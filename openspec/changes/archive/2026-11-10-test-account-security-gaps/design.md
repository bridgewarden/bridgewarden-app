# Design

## Context

See proposal.md - Why. The existing route test only reaches unauthenticated and malformed paths. `createTestUser` inserts placeholder auth material, which is enough for query tests but not for a route call that must verify a real current password proof. The Cloudflare Vitest pool provides WebCrypto, D1, and KV, and `resetDatabase()` runs before each test.

## Goals / Non-Goals

**Goals:**

- Exercise the real verifier, rotation query, and session lookup with generated key material.
- Keep every missing case independent and deterministic.
- Prove the recovery wrapper remains usable without re-encrypting vault data.

**Non-Goals:**

- Changing production code or test-only flags in application modules.
- Browser-level duplication of the existing Playwright rotation flow.
- Adding coverage for recovery reset, which is a separate change.

## Decisions

### Use real setup material, not placeholder hashes

Route tests generate material with `generateSetupKeyMaterial`, then derive the stored server auth hash with `deriveServerAuthHash` and a random server salt. This lets the route verify `currentAuthHash` through the same code path used in production.

Placeholder rows from `createTestUser` remain for query-only tests. The new helper lives in `app/__test__/password-change-fixtures.ts` because both the route suite and the account-settings suite use it. It does not modify existing shared fixtures.

### Create sessions through the real session helper

The route success test calls `createSession` and sends its cookie. The session version comes from the inserted user row. A separate case bumps `session_version` after the cookie is created to prove `requireUserApi` rejects the stale session before password verification.

### Separate layers of coverage

- Use-case tests call `changeMasterPassword` directly to assert status and row immutability for disabled, missing, and wrong-proof cases. Query compare-and-set coverage remains in `app/lib/.server/__test__/queries.test.ts`.
- Query tests assert compare-and-set behavior with two sequential calls using the same pre-rotation snapshot.
- Crypto tests operate only on generated material and do not touch D1.

This separation keeps failures attributable to one layer.

### Verify recovery preservation in the crypto layer

The recovery wrapper is never modified by password rotation. The test generates setup material, rotates the password wrapper, then unwraps the original recovery wrapper with the original recovery secret. It asserts the recovered vault key equals the setup vault key and that the old password material no longer matches the rotated values.

## Risks / Trade-offs

- **Generated PBKDF2 material makes tests slower** -> use generated material only where verification runs; use `createTestUser` and static valid-shaped bodies for disabled, missing, locked, and stale-session cases.
- **Route tests depend on KV and D1 isolation** -> reset the database in `beforeEach` and delete created session keys after each test.
- **Test helper duplicates setup logic** -> keep it small and import the production crypto helpers rather than reimplementing derivation.
- **A new test exposes a production bug** -> stop and capture the fix as a separate change; do not weaken assertions to keep this test-only change green.
