# Spec Delta

## Purpose

Defines auditable security events and redaction-safe request observability.

## ADDED Requirements

### Requirement: Complete audit event coverage

The system SHALL persist an audit event for bootstrap, login success/failure, 2FA success/failure, backup-code use, password change, recovery use, user create/disable, session revoke, logout, and permanent item purge.

#### Scenario: Item purge
- **WHEN** a user permanently purges a trashed item and the purge succeeds
- **THEN** an `item.purged` row is written for that user

#### Scenario: Existing security events
- **WHEN** a covered authentication, recovery, admin, or password action completes
- **THEN** its existing audit row remains present

### Requirement: Audit metadata and fingerprints are safe

Audit metadata SHALL be limited to the allowlisted identifier fields. Audit rows MUST NOT contain email, password, auth hash, session token, TOTP code, item ciphertext, or vault plaintext. IP and user-agent fingerprints SHALL be HMAC-derived with `AUTH_PEPPER`.

#### Scenario: Reject unsafe metadata
- **WHEN** a caller supplies credential-shaped or arbitrary metadata
- **THEN** the unsafe fields are discarded before insert

#### Scenario: Request fingerprint
- **WHEN** an event is recorded with a request
- **THEN** its IP and user-agent hashes are derived from `AUTH_PEPPER`, never stored raw

### Requirement: Structured request logging

Each request SHALL emit one structured log entry containing request id, method, normalized route pattern, status, duration, and an optional hashed user id. Query strings, bodies, cookies, authorization values, plaintext, and ciphertext MUST NOT be logged.

#### Scenario: Successful request
- **WHEN** a request completes
- **THEN** one JSON log line contains request id, method, route pattern, status, and duration

#### Scenario: User attribution
- **WHEN** a request has a valid session
- **THEN** the log contains a one-way user-id hash, not the raw id

#### Scenario: No sensitive values
- **WHEN** a request carries a query string, body, or cookie
- **THEN** none of those values appear in the log

### Requirement: Generic error response with request id

An unhandled Worker error SHALL log the stack server-side and return a generic 500 JSON body containing only `error` and `requestId`. The response SHALL expose `x-request-id`, `Cache-Control: no-store`, and security headers.

#### Scenario: Unhandled error
- **WHEN** the request handler throws
- **THEN** the client receives `{ "error": "internal_error", "requestId": "<id>" }` and the server logs the stack

#### Scenario: Request correlation
- **WHEN** an error response is inspected
- **THEN** its request id matches the server-side error log

### Requirement: Observability verification

Tests SHALL prove audit row creation for purge, fingerprint derivation, log shape, route normalization, user-id hashing, and the generic error body.

#### Scenario: Test gate
- **WHEN** the observability suite runs
- **THEN** it fails if purge is unaudited, a sensitive field reaches a log/audit row, or the error body lacks a request id
