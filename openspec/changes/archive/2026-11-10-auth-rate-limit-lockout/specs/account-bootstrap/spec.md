# Spec Delta

## ADDED Requirements

### Requirement: Rate-limited setup requests

The setup endpoint SHALL apply a per-IP request budget using an HMAC hash of the caller's address. Requests over budget MUST return 429 with `Retry-After` and MUST NOT create a user, audit event, or session.

#### Scenario: Setup rate limit rejects creation
- **WHEN** a caller exceeds the setup budget
- **THEN** the response is 429 with `Retry-After` and no user or session is created

#### Scenario: Setup budget does not reveal availability
- **WHEN** a request is rejected by the setup rate limit
- **THEN** the response contains no information about whether the users table is empty
