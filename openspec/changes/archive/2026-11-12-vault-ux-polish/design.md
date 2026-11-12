# Design

## Context

See `proposal.md` for motivation. TASK-15/16 are merged. The trash API, restore/purge endpoints, and outbox mutation kinds already exist; the UI is still a placeholder. Empty/error/offline UI is currently duplicated inline, and the root error boundary is development-oriented. The authenticated header exposes several text actions without a compact mobile mode.

Scope excludes search and its palette; TASK-39 owns those. The trash contract stops at restorable tombstones; purged metadata tombstones are not listed.

## Goals / Non-Goals

**Goals:**

- Trash listing with decrypted names, restore, purge confirmation, and navigation count.
- Shared state components and a production-safe error boundary.
- Global offline banner with cached content still readable.
- Responsive header and full-screen mobile editor, verified at 360/768.
- Tests for trash mutation flows, error presentation, and viewport overflow.

**Non-Goals:**

- New vault fields, attachment handling, search, or search-palette responsiveness.
- Changing restore/purge server semantics or database schema.
- A formal accessibility/performance audit; TASK-18 owns that.

## Decisions

### Trash uses a dedicated projection

Add a `readVaultTrash()` projection that decrypts cached tombstones with non-empty ciphertext. It returns item metadata plus `deletedAt` and folder label. Corrupt tombstones are skipped; purged tombstones (`dataCt === ''` or `dataIv === ''`) are excluded.

The live list projection remains unchanged and continues to exclude tombstones.

### Trash mutations use the existing outbox

The trash hook reads the current cached row before mutation:

- restore: optimistic `deletedAt: null`, previous row, `item.restore`;
- purge: optimistic row with empty ciphertext/IV, previous row, `item.purge`.

Both call `flushOutbox` and refresh the trash projection. Purge removes the row from trash after the optimistic cache update; failure rollback restores it and shows a generic toast. Restore preserves `folderId`, so the item returns to its folder.

### Purge confirmation is deliberate

Use one shared confirmation dialog:

- trash count > 5: input must exactly match the decrypted item name;
- trash count <= 5: destructive confirmation only.

The confirm action is disabled until valid and is a real button in an alert dialog. Reopening the dialog clears the typed name.

### Trash count is metadata-only

A small client store counts cached tombstones with non-empty ciphertext. It subscribes to vault sync/outbox/key events and refreshes after sign-out/wipe. The header displays a count badge only when > 0. It does not decrypt names just to show the count.

### Shared state components live in app/components

Add:

- `EmptyState`
- `SkeletonList`
- `InlineError`
- `OfflineBanner`
- `ErrorToast` helper/component for catalog-backed toast failures

They accept catalog-backed strings/actions through props; no feature imports another feature. Adopt them in list, editor, trash, generator, and settings where the existing ad-hoc markup is equivalent.

Skeletons use the same row/card dimensions as final content to avoid layout shift.

### Global offline state

Add a client online-status hook backed by `navigator.onLine` and `online`/`offline` events. The shell renders one global offline banner; the list stops rendering its duplicate offline alert. Cached items remain visible.

### Root error boundary and server logging

The root boundary keeps raw stack details only in development. Production renders catalog copy plus retry (same route) and a safe vault link. The request identifier stays in the server log; it is not rendered in HTML.

The Worker fetch entry catches unhandled request errors, generates a request id, logs only method/path/id/error class, and returns a generic text response with no-store headers. No body, vault payload, token, or ciphertext is logged.

### Responsive header and editor

At the compact breakpoint, secondary account actions collapse into a dropdown menu while lock and theme remain direct. Trash, settings, admin users, and sign-out are menu items on mobile; desktop keeps direct links.

The editor gains a mobile full-screen surface (`min-h` viewport, no fixed height) and preserves reachable back/save actions when the keyboard is open.

### Viewport verification

Add a Playwright project that runs login, list, editor, trash, and generator at 360 and 768 widths. Each case asserts `scrollWidth <= clientWidth`, required actions, and 44px targets. Do not capture authenticated screenshots because they contain vault plaintext.

## Risks / Trade-offs

- **Trash decryption cost** -> only tombstone rows are decrypted; corrupt rows are skipped.
- **Count can briefly lag sync** -> count store refreshes on sync/outbox and is advisory; the trash page remains the source of truth.
- **Full-screen editor on keyboard** -> use viewport units and normal scrolling; no fixed height.
- **Global error boundary cannot always know a request id** -> render it only when supplied; never fabricate a server id.
- **Offline banner vs sync error** -> online/offline is connectivity; sync error remains a separate retryable surface state.
- **Header menu discoverability** -> menu button has an accessible label; desktop behavior stays unchanged.

## Migration Plan

- Additive UI and projection helpers; no database migration.
- Trash is read-only against existing tombstones until restore/purge is invoked.
- Rollback is safe: no server contract changes.

## Open Questions

None. Search palette responsiveness is explicitly deferred to TASK-39.
