# Proposal

## Why

TASK-19 requires an auditable, redaction-safe release surface. The current audit layer is mostly present, but item purge is not audited, request fingerprints are inconsistent, and the Worker only logs failed requests with no status, duration, route pattern, or user-id hash. The 500 path returns plain text rather than a request-id JSON response.

This change covers TASK-52 and TASK-54 only. Documentation, remaining E2E coverage, and production deploy stay in later changes.

## What Changes

- Add `item.purged` audit emission after a successful permanent purge.
- Derive audit IP/UA fingerprints through one `auditFingerprints` path keyed by `AUTH_PEPPER`, and keep metadata to the strict identifier allowlist.
- Add structured request logging with request id, method, normalized route pattern, status, duration, and a hashed user id only.
- Add a Worker-level error handler that logs the stack server-side and returns `{ error: 'internal_error', requestId }` with `x-request-id` and `Cache-Control: no-store`.
- Add unit tests for log shape, route normalization, user hashing, audit fingerprints, and purge audit.
- Add an E2E/audit assertion that purge produces the expected row without plaintext.

## Capabilities

### New Capabilities

- `release-observability`: audit coverage, safe metadata/fingerprints, structured request logs, and request-id error handling.

### Modified Capabilities

None.

## Impact

- `app/lib/.server/audit.ts`, `app/lib/.server/queries/audit-events.ts`, `app/lib/.server/request-fingerprint.ts`.
- `app/routes/api.vault.items.$id.purge.ts`.
- New `app/lib/.server/log.ts`.
- `workers/app.ts`.
- Tests, `e2e/vault-trash.spec.ts`, and the `x-request-id` assertion in `e2e/security.spec.ts`.
- No database migration, API contract change, or new dependency.
