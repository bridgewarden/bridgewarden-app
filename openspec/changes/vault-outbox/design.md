# Design

## Context

See `proposal.md` - Why. Local cache/sync (version 1) stores ciphertext items, folders, one active wrapped-key record, and sync state. The vault API create route currently generates the item UUID server-side and always allocates a revision. There is no mutation queue or optimistic write path.

## Goals / Non-Goals

**Goals:**

- Durable FIFO outbox with ciphertext-only payloads.
- Atomic optimistic cache + outbox enqueue.
- Exactly-once item creation through client ids and server replay.
- Ordered flush with stop-on-first-failure and conflict rollback.
- Conflict/error events for future UI.

**Non-Goals:**

- Editor UI.
- Automatic retry backoff or background sync.
- Conflict merging.
- Offline reload/PWA.
- Key lifetime or auto-lock.

## Decisions

### IndexedDB version 2 adds an outbox store

```text
outbox keyPath seq { autoIncrement: true }
value: {
  seq?: number,
  kind: 'item.create' | 'item.update' | 'item.trash' | 'item.restore' | 'item.purge'
      | 'folder.create' | 'folder.rename' | 'folder.delete',
  idempotencyId: string | null,
  payload: encrypted transport payload + expected rev where applicable,
  previous: cached row | null,
  optimistic: cached row/tombstone | null,
  queuedAt: number
}
```

Existing version-1 stores are preserved. Upgrade creates only `outbox`. `wipeVaultDb` already deletes the whole database.

Why a single store with a discriminated operation: FIFO ordering is the core contract; separate per-operation stores would need a second ordering key.

### Enqueue and optimistic apply share one transaction

`enqueue(op)` opens one read-write transaction over `outbox` plus the affected `items`/`folders` store:

1. capture `previous` row if needed;
2. put the optimistic cached row/tombstone;
3. put the outbox entry.

If the transaction aborts, neither the optimistic row nor the queue entry survives. Rollback on conflict restores `previous` (or deletes a created row) and removes the entry in one transaction.

### Item create accepts a client UUID

The client generates `crypto.randomUUID()` before enqueue and uses it as both the outbox item id and the request `id`. The server create query becomes:

```text
UPDATE users SET vault_rev = vault_rev + 1
WHERE id = ?
  AND NOT EXISTS (SELECT 1 FROM vault_items WHERE id = ?)
  AND folder-active-or-null predicate

INSERT INTO vault_items (...) SELECT ..., ? AS id, ... FROM users
WHERE id = ? AND NOT EXISTS (SELECT 1 FROM vault_items WHERE id = ?)
RETURNING ...
```

If the insert changes zero rows, the use case reads the item by `id` and session user:

- owned row exists -> `{ status: 'existing', item }`, route 200, no new rev;
- no owned row -> 404, so a foreign id collision is indistinguishable from a missing id and no row is exposed. An owned tombstone/purged row returns 409.

Server-generated ids remain supported for non-outbox callers. The parser accepts optional UUID `id`; invalid UUID is 400.

### Flush is single-flight and FIFO

`flush()` holds one module-level promise. It reads entries ordered by `seq` and for each:

```text
2xx -> upsert server row into cache, delete entry
409 -> restore previous/delete optimistic row, delete entry, emit conflict, syncVault()
400/404 -> restore previous, delete entry, emit error (404 also syncs)
5xx/network -> stop, keep entry and every later entry
```

A successful create response (201 or 200) replaces the optimistic row with the server row and revision. No retries within the same flush loop; a later `flush()` retries retained entries. This is deliberately simple and observable.

### Events and cache helpers

`subscribeOutboxEvents(listener)` emits `{ type: 'conflict'|'error'|'flushed', op }`. No UI mounts it yet. Optimistic and rollback writes execute inside the same IndexedDB transaction as the outbox entry so they stay ciphertext-only and atomic.

### Update/delete idempotency boundary

Only create gets a client id idempotency key. Update/trash/restore/purge use `rev`/state guards. An ambiguous successful update retried after the server commit will return 409; the outbox treats it as conflict, refetches, and surfaces the notice instead of overwriting. This matches the PRD's no-merge rule.

## Risks / Trade-offs

- **Ambiguous create response lost after server commit** -> retry with same id returns the existing row; tests simulate this.
- **Outbox growth** -> entries are removed on success/failure classification; no automatic compaction needed yet.
- **Conflict handling is coarse** -> accepted; the refetch is authoritative and no merge is attempted.
- **Multiple tabs flush concurrently** -> IndexedDB transactions serialize queue writes, but two tabs can still send the same create id; server idempotency makes it safe. A future BroadcastChannel lock can reduce duplicate traffic.
- **Folder delete detach** -> outbox stores the folder operation; server returns the tombstone; cache sync handles detached items.
- **No backoff** -> failed entries retry only when flush is invoked again, avoiding tight loops.

## Migration Plan

1. Bump the local database to version 2; preserve existing stores.
2. Ship API client-id support before or with client enqueue.
3. Verify duplicate create replay returns 200 and no extra rev.
4. Rollback application code; version-2 database with an empty outbox remains readable by version-1 stores. A future version can drop the store if needed.

## Open Questions

None.
