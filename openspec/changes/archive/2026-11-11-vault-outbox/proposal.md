# Proposal

## Why

The local cache can read and sync ciphertext but cannot queue mutations. Editors need optimistic writes that survive reload and retry safely. The current item create endpoint always allocates a server UUID, so an ambiguous network retry can create duplicate items. This change adds the durable outbox and the minimal idempotent-create contract required for exactly-once offline creates.

Requirement: `TASK-36` (outbox and optimistic mutation portion).

## What Changes

- Upgrade the browser database to version 2 with an `outbox` store for ordered, encrypted mutation payloads.
- Add outbox operations for item and folder mutations, enqueue, ordered flush, stop-on-first-failure, and conflict events.
- Add optimistic cache apply/rollback helpers used by future editors.
- Extend `POST /api/vault/items` to accept an optional client-generated UUID. The server MUST allocate a revision only for a new id and return the existing owned row for a retry with the same id.
- Return 201 for a new item and 200 for an idempotent replay; both are success for the outbox.
- Keep update/trash/folder retries on their existing revision/conflict semantics; no conflict merge.
- Wipe the outbox with every other store on logout/account switch.
- No editor UI, retry backoff, offline reload, or key lifetime in this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-client`: add the durable outbox, optimistic apply/rollback, flush ordering, stop-on-failure, and conflict event contract.
- `vault-api`: make item creation accept a client id and replay the existing owned row idempotently without consuming another revision.

## Impact

- IndexedDB schema version 2 and outbox store.
- New `app/lib/vault/outbox.ts` and cache helpers.
- New create-item id validation and conditional rev/insert query behavior.
- Tests with fake-indexeddb and mocked fetch; no Playwright editor flow until TASK-40.
- No migration, no server schema change, no UI.
