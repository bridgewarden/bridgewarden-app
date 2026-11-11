# Design

## Context

See `proposal.md` - Why. `lockVault()` already clears the in-memory key and the shell already renders `LockedOverlay` for protected routes. Key lifetime, five-failure logout, and local unlock are complete. Account settings is a client page composed from feature cards.

## Goals / Non-Goals

**Goals:**

- Idle timeout 1/5/15/30/60/never, default 15.
- Activity resets the deadline.
- Optional tab-hide lock, default off.
- Settings take effect immediately and persist across reloads.
- Reuse the existing lock/overlay/unlock paths.

**Non-Goals:**

- Server-side session timeout changes.
- Encrypted cache expiry (key material keeps its 30-day TTL).
- Locking on route change or network loss.
- Changing five-failure logout or local unlock.

## Decisions

### A small preference store, not React state

`app/lib/vault/auto-lock.ts` owns a cached preference snapshot and a listener set. The shell and settings card both use `useSyncExternalStore`, so a change in settings reaches the timer without a reload.

```text
AutoLockPreferences = { minutes: 1|5|15|30|60|'never'; lockOnHide: boolean }
DEFAULT = { minutes: 15, lockOnHide: false }
keys: bw_auto_lock_minutes, bw_lock_on_hide
```

Invalid or unavailable storage falls back to defaults. The store never touches vault data or key material. Writes persist only the changed key, and a `storage` listener refreshes the snapshot when another tab changes the policy. Sign-out, or a new authenticated session after an unauthenticated visit, resets the preference to the 15-minute/default-off policy so the next account on a shared device does not inherit a weaker setting.

### Pure decisions separate from side effects

The module exposes:

```text
timeoutMs(minutes): number | null
isIdleExpired(lastActivity, now, minutes): boolean
shouldLockOnVisibility({ hidden, lockOnHide, lastActivity, now, minutes }): boolean
```

`shouldLockOnVisibility` returns true when hidden and hide-lock is on, or when visible and the idle deadline has passed. This keeps visibility behavior unit-testable without faking document state.

### One effect in the shell owns the timer

When unlocked:

- Record `lastActivity`.
- If the timeout is not `never`, arm a `setTimeout` for the remaining duration from a shared `lastActivity` timestamp.
- Reset the deadline on `pointerdown`, `keydown`, `touchstart`, and captured passive `scroll`. Activity that arrives after the deadline locks instead of granting a new window.
- On `visibilitychange`: lock immediately if hidden + hide-lock; otherwise on return, lock if expired, else re-arm for the remaining time. A document already hidden at arm time is checked too.
- Cleanup removes listeners and clears the timer.

Every path calls `lockVault()`; the existing shell then removes protected children and shows the overlay.

### Settings card

`AutoLockCard` in `features/account-settings/components/` renders a labelled select and checkbox backed by the store. It is client-only; the server snapshot is the default, then hydration reads the persisted values. No loader changes are needed.

### Persistence scope

Preferences are device-local and persist across reloads. A successful sign-out resets them to the 15-minute/default-off policy so a shared device does not hand the next account a weaker setting. Vault key material and ciphertext remain governed by the existing wipe rules.

## Risks / Trade-offs

- **Timer throttling in hidden tabs** -> visibility return checks `now - lastActivity`, so a delayed timer still locks promptly.
- **Settings flash before hydration** -> card starts with defaults then updates from storage; no vault content is involved.
- **Long timeouts and laptop sleep** -> returned visibility and activity events compare timestamps; activity after the deadline locks instead of postponing it.
- **Storage unavailable** -> in-memory defaults keep the timer working for the session.
- **Event volume** -> only discrete pointer/key/touch plus passive scroll; no mousemove listener.
- **Multiple tabs** -> each tab applies its own timer, refreshes preferences through `storage`, and receives lock broadcasts through `BroadcastChannel`.

## Migration Plan

1. Add the preference store and pure helpers.
2. Wire the shell timer and visibility handling.
3. Add the settings card and copy.
4. Verify with fake clocks before manual lock and local unlock remain unchanged.
5. Roll back by removing the timer/settings; manual lock is unaffected.

## Open Questions

None.
