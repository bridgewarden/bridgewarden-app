# Design

## Context

`app/root.tsx` renders every route inside `AppShell`. The shell receives `user` from the root loader and decides whether a protected route is active from `routes/protected`. Today `AppHeader` always renders the authenticated action cluster, including a disabled lock button and a sign-in icon on public pages. `LockedOverlay` is a hand-rolled `Card` with `role="dialog"`, no focus trap, no focus restoration, and an immediate sign-out on the fifth failed local unlock. See `proposal.md` and the `app-shell` delta for the required behavior.

## Goals / Non-Goals

**Goals:**

- Make the approved Signal palette and technical-utility geometry real in the shared token layer.
- Give public and authenticated pages appropriate header variants without adding a route layout.
- Make navigation state and mobile account identity explicit.
- Replace the locked overlay with a focus-managed dialog while preserving local unlock semantics.

**Non-Goals:**

- No `PageHeader` or `SectionNav`; they land with their first consumers.
- No login, setup, vault, settings, or admin page redesign.
- No new routes, server functions, database, auth/crypto logic, dependencies, or fonts.

## Decisions

### One shell, two header variants

Keep `AppShell` as the single frame. Derive `isPublic = user === null`; render the public header when true and the authenticated header when false. Do not add a public route layout or duplicate document shells.

Public header: product mark and `ThemeControl`. No disabled lock button and no sign-in placeholder. Auth pages remain inside the same shell so theme and brand positioning are stable.

Authenticated header: navigation, lock action, and account menu. Admin link remains gated by `role === 'admin'`. Use pathname to set `aria-current="page"`; treat `/app/new` and `/app/edit/*` as Vault destinations. The mobile dropdown gets `DropdownMenuLabel` with display name or email.

Alternative: a public `layout()` route. Rejected because it changes the route tree and duplicates shell/theme ownership for a visual variant.

### Signal token mapping in `app/app.css`

Preserve the existing Tailwind/shadcn imports and the single `light-dark()` token block. Map:

- `--background` / `--foreground` → paper / ink.
- `--card` / `--popover` → surface; foreground → ink.
- `--secondary` / `--muted` → paper-2; muted foreground → ink-2.
- `--primary` → cobalt accent; `--primary-foreground` → accent ink.
- `--accent` → accent-soft; `--accent-foreground` → accent text.
- `--border` / `--input` → rule; `--ring` → focus cobalt.
- Keep `--destructive` red.

Set `--radius: 0.5rem`, with `--radius-md` 6px for controls, `--radius-lg`/`--radius-xl` 8px for surfaces. Add `--font-mono` to `@theme inline` using the system monospace stack. Do not add a third-party font or a second token file.

### Locked overlay uses Radix Dialog

Render a controlled `Dialog` with `open` true, `showCloseButton={false}`, `onEscapeKeyDown` prevented, and `onInteractOutside` prevented. Use `DialogTitle`/`DialogDescription` for the accessible name/description. Keep the password form and sign-out action inside the content. AppShell continues to render the overlay instead of protected children, so vault content is not behind it.

Focus restoration: keep AppShell's existing `lockButtonRef` focus effect after `locked` becomes false. That is the safe return target. The dialog handles the in-dialog trap. Add a cleanup timer for the lockout sign-out delay.

Lockout: on `locked-out`, set the error first, disable the form, and call `onSignOut` after a short delay (about 1.2s) so the message is rendered. Clear the timer on unmount/manual sign-out.

Alternative: manual focus trap. Rejected because Radix already supplies the behavior and the project already depends on it.

### No page primitives yet

`PageHeader` and `SectionNav` are not introduced until PR 04/07. They have no consumer in PR 1, and adding unused abstractions makes the foundation PR harder to review.

## Risks / Trade-offs

- [Public header removes the disabled lock control expected by an old E2E] → Update `e2e/auth.spec.ts` to assert the public theme control and absence of lock/account controls.
- [Radix Dialog changes DOM/focus behavior] → Keep `role="dialog"` and the existing copy; add E2E assertions for password focus, Escape staying open, focus restore, and the lockout message.
- [Token changes affect every surface at once] → Run full E2E and axe checks; keep page-level layout edits out of PR 1.
- [Cobalt primary changes every primary button] → Verify contrast in light/dark and use the PoC palette as the visual reference.
- [Mobile menu identity can crowd the popover] → Use a non-interactive `DropdownMenuLabel`, truncate the email, and test at 360px.

## Migration Plan

No data or API migration. Deploy the Worker as usual. Rollback is a normal code revert; no route or persistent state changes.

## Open Questions

None.
