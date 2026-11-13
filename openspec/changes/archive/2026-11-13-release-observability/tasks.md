# Tasks

## 1. Audit completion

- [x] 1.1 Unify audit fingerprint derivation on `auditFingerprints` with `AUTH_PEPPER`.
- [x] 1.2 Record `item.purged` only when the guarded purge changed a row; keep metadata free of item ids, ciphertext, and plaintext.
- [x] 1.3 Add unit tests for request fingerprints, purge success/failure audit behavior, and unsafe metadata rejection.
- [x] 1.4 Add an E2E assertion that a successful trash purge writes an `item.purged` row with no plaintext metadata.

## 2. Request logging and errors

- [x] 2.1 Add `app/lib/.server/log.ts` with route-pattern normalization, `AUTH_PEPPER`-keyed user hashing, request log JSON, and error JSON response.
- [x] 2.2 Update `workers/app.ts` to time each request, log one redaction-safe entry with request id/method/route/status/duration/user hash, and set `x-request-id` on every response.
- [x] 2.3 On an unhandled error, log the stack server-side and return the generic `{ error: 'internal_error', requestId }` 500.
- [x] 2.4 Add unit tests for log shape, route normalization, user-hash non-disclosure, query/body/cookie exclusion, and error response correlation.

## 3. Verification

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm format:check`
- [x] 3.2 `pnpm test` and `pnpm test:e2e --project=vault-trash`
- [x] 3.3 `pnpm build`
- [x] 3.4 `openspec validate release-observability --strict`
