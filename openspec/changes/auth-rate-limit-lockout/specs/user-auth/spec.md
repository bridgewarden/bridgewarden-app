# Spec Delta

## ADDED Requirements

### Requirement: Rate-limited authentication requests

Authentication endpoints SHALL apply request budgets derived from HMAC hashes of the caller's IP and, when available, the account identifier. Requests over budget MUST return 429 with a `Retry-After` header and no credential or session result. Raw IP addresses and emails MUST NOT be stored as rate-limit keys.

#### Scenario: Login rate limit rejects the request
- **WHEN** a caller exceeds the login budget for its IP hash or email hash
- **THEN** the response is 429 with `Retry-After`, and no password verification or session issuance occurs

#### Scenario: Two-factor rate limit rejects the request
- **WHEN** a caller exceeds the two-factor budget for its IP hash or challenge identity
- **THEN** the response is 429 with `Retry-After`, and the challenge is not consumed

#### Scenario: Limits are keyed by hashes
- **WHEN** a request is rate limited
- **THEN** no raw IP address or email is persisted in the rate-limit key

### Requirement: Account lockout after consecutive password failures

A known active account SHALL become locked after ten consecutive failed password attempts. The lock MUST last 15 minutes and a login attempt during the lock MUST return 423 with `Retry-After` without verifying or issuing a session. Unknown emails MUST continue to return the generic 401.

#### Scenario: Tenth failure locks the account
- **WHEN** the tenth consecutive password attempt fails for a known active account
- **THEN** the account's `locked_until` is set to 15 minutes from that attempt

#### Scenario: Locked account is rejected
- **WHEN** a login attempt targets an account whose `locked_until` is in the future
- **THEN** the response is 423 with `Retry-After` and no session is issued

#### Scenario: Unknown email remains generic
- **WHEN** an unknown email is submitted
- **THEN** the response remains the generic 401 and no lock state is created

### Requirement: Lockout reset and per-account isolation

A successful password login SHALL reset the account's consecutive failure count and lock deadline. A lock on one account MUST NOT lock another account, though the shared IP budget MAY still apply.

#### Scenario: Success resets counters
- **WHEN** a correct password is accepted before or after a lock expires
- **THEN** `failed_login_count` returns to zero and `locked_until` is cleared

#### Scenario: Another account remains usable
- **WHEN** one account is locked from an IP
- **THEN** a different account from the same IP can authenticate unless the shared IP budget is exhausted
