# Design

## Context

See `proposal.md` for motivation. The existing vault list already syncs ciphertext, decrypts a reduced projection, and queues mutations through the IndexedDB outbox. The vault API already supports create, optimistic update, trash, and restore. The missing work is a full-payload editor and a ciphertext budget large enough for the required 50KB note.

Current constraints:

- The vault key lives only in module memory; editors must not persist plaintext.
- Protected routes render inside the existing app shell and locked overlay.
- The server never decrypts item payloads.
- The outbox is ordered, validates ciphertext, rolls back optimistic rows on 409, and emits conflict events.
- No form library is installed.

## Goals / Non-Goals

**Goals:**

- Full create/edit surfaces for login items and notes, with all TASK-40/41 fields.
- Full-payload decryption for editing without changing the list projection contract.
- Save, update, delete, and undo through the existing outbox.
- Explicit conflict resolution and unsaved-change protection.
- A server ciphertext ceiling that accepts the maximum valid note.

**Non-Goals:**

- Password or TOTP generation, clipboard actions, and item-level TOTP code generation.
- Trash page, responsive mobile polish, attachments, folder management, search, and import/export.
- Changing the server-side encryption model or storing plaintext server-side.

## Decisions

### Protected editor route with `new` as a sentinel id

Add one protected route at `app/items/:itemId`; `/app/items/new` uses the sentinel `new`. The route module is transport-only and renders `features/vault-item/vault-item.tsx`.

Why: create and edit share the same shell, field set, dirty guard, and save path. Separate create/edit routes would duplicate those decisions. The sentinel keeps the URL explicit without adding another route module.

Alternative rejected: keep the list dialog for create. It cannot satisfy the full-field create acceptance or the unsaved-change guard.

### Full item read separate from projection

Add a vault-layer `readVaultItem(id)` that reads one cached row, decrypts its envelope, validates the payload, and returns payload plus metadata. The list continues to use the reduced `readVaultProjection`.

Why: projection intentionally drops password, TOTP secret, and custom fields, and decrypting every full payload for the list would waste work and increase plaintext lifetime. A single-item read keeps plaintext scoped to the editor.

The reader returns a new object; the caller does not receive a key buffer. The reader owns and zeroes its key copy.

### Local form state, no form dependency

Use component state for fields and a saved snapshot for dirty comparison. Use React Router's blocker plus a `beforeunload` listener while dirty.

Why: the editor is one form with nested custom fields; adding a form library for one surface increases bundle and migration cost. The task's react-hook-form reference is an implementation suggestion, not a behavior requirement.

The dirty snapshot contains plaintext only in memory and is discarded when the editor unmounts or the vault locks.

### Shared item limits and post-seal budget check

Create `app/lib/vault/limits.ts` with the payload limits and ciphertext budget shared by the client and the vault input validator. Update `item-payload.ts` to name 256, username 256, at most 10 URLs, and at most 20 custom fields. Enforce note body at 50KB UTF-8, not UTF-16 length.

After sealing, compare the standard-base64 ciphertext length against the maximum base64 length derived from the byte budget. Reject before enqueue with a size error.

Why: a 50KB note plus JSON and GCM expansion exceeds the current 64KB ciphertext cap. Checking after sealing is the only reliable total-size guard because custom fields and escaping affect the payload size.

Server changes: raise the decoded ciphertext cap to 80KB and the base64url field cap to 120,000 characters. The 256KB request-body cap stays.

Alternative rejected: lower the note limit. It would violate TASK-41.

### Outbox-driven save, conflict, and delete

Save builds a ciphertext payload and queues `item.create` or `item.update` with the cached `rev`. The optimistic row is written by the outbox. The editor subscribes to outbox events filtered by its item id. An offline save stays in the editor with a queued-locally message because protected route navigation requires the server loader; the queued item appears when connectivity returns.

- 409 conflict: keep the editor values, show reload and save-as-copy. Reload re-reads after sync; save-as-copy creates a new UUID and queues `item.create`.
- Delete: queue `item.trash` with the cached row and optimistic tombstone, navigate to the list, and show a toast with undo. Undo queues `item.restore` using the current tombstone as previous.

Why: all mutations already have durable ordering and rollback in the outbox. A second mutation path would create two conflict models and risk plaintext in network code.

### No password/TOTP generator or clipboard in this change

The editor exposes only fields and a reveal toggle for secrets. Generation and clipboard behavior remain in TASK-16.

Why: those actions are explicitly out of scope and need shared clipboard/clear behavior.

## Risks / Trade-offs

- **Plaintext editor state in React memory** -> unmount on lock, never persist, never log, and keep secret inputs out of SSR.
- **Total payload can exceed the ciphertext budget even when each field is valid** -> post-seal budget check with a clear error; no queued entry.
- **Conflict after an offline edit can be confusing** -> explicit reload/save-as-copy dialog; no silent overwrite.
- **Undo after the trash entry already flushed** -> restore is a normal queued mutation and still works until purge retention ends.
- **Server limit change affects existing clients** -> raising a maximum is backward compatible; keep the request-body cap and IV checks unchanged.
- **Large note editing can be costly** -> only encrypt on save; no per-keystroke crypto or network work.

## Migration Plan

- Deploy the server limit increase before or with the editor; old clients continue to work.
- No D1 schema migration is required.
- Rollback is safe: items created under the larger ceiling remain valid ciphertext; an older server would reject them, so rollback requires keeping the new limit or accepting those saves fail until redeployed.

## Open Questions

None.
