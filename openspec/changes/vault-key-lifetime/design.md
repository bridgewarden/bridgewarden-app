# Design

## Context

See `proposal.md` - Why. `app/lib/vault/key-store.ts` already stores the unwrapped key in a module variable and refuses storage. `app/lib/vault/key-material.ts` reads the active wrapped key plus KDF parameters from IndexedDB. Login/setup/recovery/password flows already populate that material. The shell has a disabled lock button.

## Goals / Non-Goals

**Goals:**

- Observable locked/unlocked state without putting the key in React state.
- Local unlock from cached key material with no network.
- Global overlay and manual lock from any authenticated route.
- Correct initial/reload locked behavior.
- Preserve cache and session across lock.
- Generic errors and safe sign-out fallback.

**Non-Goals:**

- Idle/auto-lock timer or timeout settings (TASK-28).
- Idle timer and visibility-based locking (TASK-28).
- Lock on visibility change (TASK-28).
- Decrypted selector cache (future vault UI).
- Recovery link from the overlay.

## Decisions

### Extend the key store with a subscription, not a React copy

`key-store.ts` keeps the key in its module variable and adds:

```text
subscribeKeyState(listener): unsubscribe
isUnlocked(): boolean
```

`setVaultKey` and `clearVaultKey` notify subscribers. `getVaultKey()` remains copy-on-read. No component receives the key as a prop, context value, or state.

### Lock and unlock live in a non-React module

`app/lib/vault/lock.ts`:

```text
lockVault() -> clearVaultKey(); future selector cache reset
unlockVault(password):
  material = readKeyMaterial()
  if !material -> { status: 'unavailable' }
  prepared = prepareLogin(password, material.kdfSalt, material.kdfIterations)
  vaultKey = unwrapLoginVault(material.vaultKeyWrapped, material.vaultKeyWrapIv, prepared.wrapKey)
  setVaultKey(vaultKey); vaultKey.fill(0); prepared.wrapKey.fill(0)
  -> { status: 'ok' } | { status: 'invalid' } | { status: 'unavailable' }
```

Wrong password is detected from `WrongPasswordError` and returns `invalid`; missing/expired material and IndexedDB failure return `unavailable`. No server call.

### React state is a boolean derived via `useSyncExternalStore`

`AppShell` subscribes directly to the key store with a module-level server snapshot:

```text
const lockedSnapshot = () => false;
const unlocked = useSyncExternalStore(subscribeKeyState, isUnlocked, lockedSnapshot);
```

The server snapshot is `false` (locked). This ensures authenticated SSR and the first client render show the overlay until hydration confirms a key. After login, `setVaultKey` notifies and the overlay disappears.

### The overlay is a protected-layout gate

`app/components/locked-overlay.tsx` renders a fixed, full-screen `role="dialog" aria-modal="true"` panel with password input, busy state, generic error, and sign-out. The shell derives `protectedRoute` from `useMatches()` containing the `routes/protected` layout and renders the overlay when `user && !unlocked && protectedRoute`; gated route children are not rendered, so no vault content is mounted behind the overlay. Public routes remain usable while the key is locked. Focus moves to the password field on lock. Sign-out reuses the shell logout fetcher, which revokes the session and wipes IndexedDB.

The overlay never includes ciphertext or vault item content.

### Lock action

The header lock button is enabled only when `user && unlocked`. Activating it calls `lockVault()`; subscribers re-render the overlay. When no session exists the action remains disabled, matching the existing shell contract.

### Reload and missing material

A reload always starts with an empty memory key, so an authenticated protected page is locked. The per-tab failure counter survives reload, so five failures cannot be bypassed by refreshing. Public routes remain available. If `readKeyMaterial()` returns null (expired/missing), unlock returns `unavailable`; the overlay shows a generic message and the sign-out action is the recovery path. Legacy accounts can sign in again to repopulate material.

### Five failures force sign-out

Invalid local unlocks increment a per-tab counter persisted in `sessionStorage` (non-sensitive). The fifth invalid attempt returns `locked-out`; the overlay submits the existing sign-out action, which revokes the session, clears the key, and wipes IndexedDB. A successful unlock or completed sign-out clears the counter. The unlocked state itself is never stored.

### Server bundle safety

`setVaultKey` is called only from browser effects/handlers. The lock module is client-only by usage, but it remains a plain module so it can be tested without Workers. No server loader imports it.

## Risks / Trade-offs

- **Overlay SSR/hydration flash** -> server snapshot is locked, so the first paint is the overlay, not vault content.
- **Background sync while locked** -> `syncVault` already requires an in-memory key; cache remains readable only through future selectors that also require the key.
- **Missing cache material** -> unlock unavailable; sign-out/login is the only path until the recovery-key regeneration flow exists.
- **Focus trap** -> minimal overlay focuses the field and uses `aria-modal`; full focus trapping belongs to the hardening accessibility pass.
- **Module state on the server** -> no server path calls `setVaultKey`; tests retain the existing storage assertion.
- **No timer yet** -> manual lock only until TASK-28.

## Migration Plan

1. Add key-store subscribers and lock module/hook.
2. Add overlay and enable the shell lock action.
3. Verify login → lock → unlock without network, reload → overlay, and sign-out from overlay.
4. Roll back by removing the overlay/lock action; cache and session data are unaffected.

## Open Questions

None.
