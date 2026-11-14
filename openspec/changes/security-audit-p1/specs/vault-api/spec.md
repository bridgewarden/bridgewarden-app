# Spec Delta

## ADDED Requirements

### Requirement: Delta-visible scheduled cleanup

Scheduled trash cleanup SHALL preserve a rev-stamped deletion signal for every removed item or folder until clients can observe it through the delta contract. Cleanup MUST NOT make a previously visible tombstone disappear without an equivalent delta signal.

#### Scenario: Offline client learns of cleanup

- **WHEN** a client syncs with a `since` watermark older than a tombstone that scheduled cleanup processed
- **THEN** the delta reports the deletion and the client can remove its cached row

### Requirement: Per-user item storage quota

Authenticated item creation SHALL enforce a per-user item-count and ciphertext-byte quota in the same atomic write decision. A request over either quota MUST return the existing `409 limit` contract and MUST NOT consume a revision.

#### Scenario: Quota rejects creation

- **WHEN** a member at the item or byte quota creates another item
- **THEN** the server returns `409 limit` and the stored rows and revision are unchanged

#### Scenario: Quota is independent of source address

- **WHEN** one member changes source addresses
- **THEN** the per-user quota still applies and the identity-scoped limiter remains in force
