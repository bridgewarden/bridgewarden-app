# web-security Specification

## Purpose
Defines the browser security boundary for authenticated pages: nonce-based CSP, hardening headers, CSRF/origin enforcement, and response privacy.

## Requirements

### Requirement: Nonce-based content security policy

Every document response SHALL include a CSP with a unique per-request nonce for scripts and styles. `script-src` MUST NOT contain `unsafe-inline`; inline hydration scripts MUST carry the nonce. The policy SHALL restrict default, image, connect, frame-ancestor, base-uri, and form-action sources.

#### Scenario: Document CSP
- **WHEN** a document response is returned
- **THEN** its CSP contains `script-src 'self' 'nonce-<unique>'` and `object-src 'none'`

#### Scenario: Nonce changes per request
- **WHEN** two document requests are made
- **THEN** their nonces differ and the prior nonce is not reusable

#### Scenario: Inline hydration script
- **WHEN** the document renders React Router hydration scripts
- **THEN** every inline script carries the request nonce and executes without CSP console violations

#### Scenario: Style attributes
- **WHEN** generated primitives require inline style attributes
- **THEN** only the narrowest documented style-attribute exception is allowed and script execution still requires the nonce

### Requirement: Hardening headers

Document and API responses SHALL set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, and HSTS on HTTPS production responses. Authenticated HTML MUST be `Cache-Control: no-store`.

#### Scenario: Document headers
- **WHEN** an authenticated document is returned
- **THEN** nosniff, no-referrer, Permissions-Policy, HSTS, and no-store are present as applicable

#### Scenario: API headers
- **WHEN** an API response is returned
- **THEN** nosniff and no-referrer are present and no vault data is cached

### Requirement: Mutation origin enforcement

Every state-changing request SHALL require a same-origin Origin matching the configured app origin and MUST use a non-GET method. No loader may mutate state.

#### Scenario: Cross-origin mutation
- **WHEN** a POST/PATCH/DELETE has a foreign or missing Origin
- **THEN** the request is rejected and no state changes

#### Scenario: GET has no side effects
- **WHEN** a GET request is made to any route
- **THEN** no vault or session mutation occurs

### Requirement: Session cookie attributes

The session cookie SHALL remain `HttpOnly; Secure; SameSite=Lax; Path=/` with an absolute expiry. JavaScript MUST NOT be able to read it.

#### Scenario: Inspect cookie
- **WHEN** the session cookie is created
- **THEN** all required attributes are present

### Requirement: No ciphertext in SSR HTML

Vault routes SHALL render no ciphertext, decrypted item data, or vault item identifiers in server HTML. Vault content SHALL load client-side only after unlock.

#### Scenario: Seeded vault SSR
- **WHEN** `/app` is fetched with a seeded vault
- **THEN** the response body contains no vault ciphertext or item data
