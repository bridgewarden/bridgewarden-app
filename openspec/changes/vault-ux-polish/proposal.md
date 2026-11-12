# Proposal

## Why

The vault now supports full editing and credential tools, but trash is still a placeholder, error/empty/offline states are ad hoc, and several surfaces have not been proven usable at mobile widths. TASK-17 finishes those product-facing gaps without adding new vault features.

## What Changes

- Add a trash route listing soft-deleted items with decrypted name, type, folder, and deleted date.
- Add restore and permanent purge through the encrypted outbox.
- Require deliberate purge confirmation; typing the item name when trash has more than five items, otherwise a destructive confirm dialog.
- Expose a trash navigation link and count badge.
- Add shared `EmptyState`, `SkeletonList`, `InlineError`, `ErrorToast`, and `OfflineBanner` components and adopt them across vault, editor, trash, generator, and settings.
- Make the root error boundary generic in production, offer retry, and never render a raw stack trace or server payload.
- Log server errors server-side without including plaintext, secrets, or request bodies in HTML.
- Make vault surfaces usable at 360px, 768px, and 1024px+; compact the header, keep 44px touch targets, and render the editor as a full-screen surface on mobile.
- Add Playwright viewport coverage for login, list, editor, and generator.
- Exclude search palette, new vault fields, and attachments; TASK-39 owns search and its responsive palette.

## Capabilities

### New Capabilities

- `vault-trash`: trash projection, restore, purge confirmation, navigation count, and post-purge behavior.
- `ui-states`: reusable empty/loading/error/offline states, global error boundary, generic error copy, and retry actions.
- `responsive-web`: responsive header and vault surfaces, mobile editor behavior, touch targets, and viewport coverage.

### Modified Capabilities

None.

## Impact

- `app/features/vault-trash/`, `app/routes/vault-trash.tsx`, and vault projection/cache helpers.
- Shared state components under `app/components/` and adoption across existing features.
- `app/root.tsx`, `workers/app.ts`, `app/components/app-shell.tsx`, and route/error handling.
- Responsive classes across list, editor, generator, settings, login, and trash.
- i18n catalog, unit tests, and Playwright viewport projects.
- No API schema, database migration, or crypto change.
