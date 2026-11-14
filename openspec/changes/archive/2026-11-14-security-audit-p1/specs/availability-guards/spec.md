# Spec Delta

## Purpose

Bounds unauthenticated database work from health probes and setup-guard SSR loaders, and avoids charging the database before a session check when the request cannot be authenticated.

## ADDED Requirements

### Requirement: Health probe is bounded

Unauthenticated health responses SHALL use an IP-scoped limiter or an equivalent cacheable edge control before executing a shared-D1 query. A rejected probe MUST NOT execute the database check.

#### Scenario: Repeated health probes are bounded

- **WHEN** one source sends repeated health requests beyond the configured budget
- **THEN** the server rejects them before the D1 query and does not serve a stale cached document

### Requirement: SSR setup guard avoids per-request database work

Unauthenticated document loaders SHALL NOT execute an unbounded `users` count per request. The configured state SHALL be memoized with invalidation on bootstrap, and authenticated protected requests SHALL not repeat the count after the session is resolved.

#### Scenario: Authenticated request reuses configured state

- **WHEN** an authenticated request reaches a protected route
- **THEN** the setup count is served from the memoized state instead of a new D1 query

#### Scenario: Cached setup state is invalidated

- **WHEN** the first administrator is created
- **THEN** the next setup/login request observes the new configured state
