# Design

## Context

See `proposal.md`. Audit storage and most call sites already exist. The missing pieces are purge coverage, consistent request fingerprints, request-level structured logs, and a request-id JSON error response. The Worker already creates a request id and security headers; `getSessionCached` is backed by a `WeakMap`, so the Worker can reuse the route's session lookup after the handler completes without a second KV read.

## Goals / Non-Goals

**Goals:**

- Add `item.purged` audit and request-aware fingerprints.
- Emit one structured, redaction-safe log line per request.
- Return a generic JSON 500 with a correlatable request id.
- Prove audit/log/error behavior with unit and E2E tests.

**Non-Goals:**

- Docs, README, threat model, runbook, production deploy, or new E2E flows beyond the purge audit assertion.
- New dependencies or a database migration.
- Logging request bodies, query strings, cookies, headers, or vault content.

## Decisions

### Audit fingerprints use one path

Keep `AuditEvent` as a plain row shape. Audit call sites derive fingerprints with `auditFingerprints(env, request)`, which switches from `SESSION_SECRET` to `AUTH_PEPPER`, and pass them explicitly. Login, logout, 2FA challenge, complete-login, bootstrap, and purge all use this path; session records keep their own SESSION_SECRET-derived fingerprints.

`purgeVaultItem(env, userId, itemId, request)` records `item.purged` only when the guarded update actually changed a row. It returns `purged: true` for a real purge and `purged: false` for an already-purged replay. No item id, ciphertext, or plaintext enters metadata. The route stays transport-only.

### Structured log helper

Add `app/lib/.server/log.ts`:

```ts
type RequestLog = {
  event: 'request.completed' | 'request.error';
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  userIdHash: string | null;
};
```

- `normalizeRoutePattern(pathname)` replaces UUID path segments with `:id` and strips query strings. Static routes remain exact. This is the route key used in logs; it never includes search params.
- `hashUserId(env, userId)` returns a short HMAC-SHA-256 hex digest keyed by `AUTH_PEPPER`, or `null` when no session/user is available.
- `writeRequestLog` emits one JSON line via `console.log` on success and `console.error` for errors. Error entries add `errorName` and `stack` server-side; no body/query/cookie.
- `buildErrorResponse(requestId)` returns `application/json`, status 500, `Cache-Control: no-store`, `x-request-id`, and `{ error: 'internal_error', requestId }`.

### Worker flow

```text
requestId = randomUUID()
startedAt = performance.now()
context = Cloudflare + security nonce
try:
  response = handler(request, context)
  wrapped = applySecurityHeaders(...)
  session = peekSession(request)                        // no KV/D1 read
  writeRequestLog(completed, status, duration, hash)
  if status >= 500: writeRequestLog(error, status, duration, null)
  wrapped.headers.set('x-request-id', requestId)       // all responses
  return wrapped
catch error:
  route = normalizeRoutePattern(pathname)
  writeRequestLog(error with stack)
  return applySecurityHeaders(buildErrorResponse(requestId))
```

The success log is emitted before returning; `x-request-id` is set on every response, not only 500s. `peekSession` reads only the request's WeakMap entry and never performs a KV/D1 lookup; unauthenticated or uncached requests log `userIdHash: null`.

### Tests

- `audit.test.ts`: request fingerprints use `AUTH_PEPPER`, unsafe metadata stays stripped.
- New `log.test.ts`: route normalization, user hash stability/non-raw id, JSON shape, no query/body/cookie fields, error body shape.
- Purge route test: `item.purged` inserted only on success, not on 404/500.
- E2E vault-trash: after purge, query D1 for an `item.purged` row for the user and assert no plaintext/name appears in audit metadata.

## Risks / Trade-offs

- **Route pattern is normalized path, not React Router route id** → stable `/api/vault/items/:id` shape without coupling Worker logging to the route manifest; static routes remain exact.
- **AUTH_PEPPER change for fingerprints** → historical audit hashes remain valid as opaque values; new fingerprints use the new key. No migration or lookup depends on the old key.
- **Session lookup after response** → peeking avoids duplicate KV/D1 reads; unauth/uncached requests return no user hash.
- **Log volume** → one line per Worker request; no body/header serialization.

## Migration Plan

- Deploy with the same D1 schema; no migration.
- Existing audit rows stay; only new events/fingerprints change.
- Rollback is code-only; logs and audit rows remain append-only.

## Open Questions

None.
