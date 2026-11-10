# Spec Delta

## MODIFIED Requirements

### Requirement: Atomic item creation

`POST /api/vault/items` SHALL create an encrypted item for the session user with a `rev` strictly greater than the user's previous `serverRev`. The body MAY include a client-generated UUID `id`. Rev allocation MUST occur only for an id that does not already exist for the session user, and the insert MUST commit atomically with the allocation. A retry with the same owned id MUST return the existing row without creating a duplicate or consuming another revision. A new item returns 201; an idempotent replay returns 200.

#### Scenario: Create succeeds
- **WHEN** a valid item body without an id is submitted by an authenticated user
- **THEN** the response is 201 with the server-generated id and a new `rev`

#### Scenario: Client id accepted
- **WHEN** a valid body includes a UUID id
- **THEN** the created row uses that id and a new revision

#### Scenario: Idempotent replay
- **WHEN** the same owned id is submitted again
- **THEN** the response is 200 with the existing row and no revision is consumed

#### Scenario: Foreign id collision
- **WHEN** the id belongs to another user
- **THEN** the response is 404 and no foreign row is revealed

#### Scenario: Invalid id
- **WHEN** the provided id is not a valid UUID
- **THEN** the response is 400

#### Scenario: Revision advances
- **WHEN** a new item is created
- **THEN** the user's `serverRev` increases and the item is visible in the next delta

#### Scenario: Missing folder
- **WHEN** the item references a folder that does not belong to the session user
- **THEN** the response is 404 and no item is written

#### Scenario: Failed insert rolls back
- **WHEN** the insert statement fails after rev allocation
- **THEN** the batch leaves no item and no committed rev allocation
