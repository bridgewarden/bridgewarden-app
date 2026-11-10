# Tasks

## 1. Key state and lock module

- [x] 1.1 Extend `key-store.ts` with `subscribeKeyState` and `isUnlocked`, notifying on set/clear; verify existing copy/zero/storage tests still pass.
- [x] 1.2 Add `lockVault()` and `unlockVault(password)` using cached wrapped key/KDF; verify correct password sets the key, wrong password returns invalid, and no server call is made.
- [x] 1.3 Verify missing/expired material and IndexedDB failure return `unavailable` without throwing into the overlay.
- [x] 1.4 Subscribe in `AppShell` with `useSyncExternalStore`, a stable locked server snapshot, and direct lock/unlock actions; verify subscription cleanup.
- [x] 1.5 Count invalid local unlocks per tab; the fifth forces locked-out, sign-out, and wipe; verify a correct password cannot bypass the count.

## 2. Overlay and shell

- [x] 2.1 Add `locked-overlay` with a labelled password field, busy state, generic invalid/unavailable errors, and sign-out; verify focus moves to the field and dialog semantics are present.
- [x] 2.2 Render the overlay from `AppShell` when an authenticated user is locked, covering main content and preventing vault content interaction.
- [x] 2.3 Enable the header lock button only when authenticated and unlocked; verify no-session state stays disabled and the action works on any protected route.
- [x] 2.4 Verify sign-out from the overlay revokes the session, wipes IndexedDB, clears the key, and navigates to login.

## 3. Reload and navigation behavior

- [x] 3.1 Verify an authenticated SSR/first client render is locked and does not expose vault content before hydration.
- [x] 3.2 Verify a reload with valid session and cached material shows the overlay until local unlock succeeds.
- [x] 3.3 Verify navigating between protected routes after unlock does not re-prompt and keeps the key in memory.
- [x] 3.4 Verify lock retains IndexedDB ciphertext/key material/session while removing the in-memory key.

## 4. Tests and documentation

- [x] 4.1 Add unit tests for lock/unlock success, wrong password, unavailable material, subscriber notifications, and no-network unlock.
- [x] 4.2 Add an E2E flow: login → lock → wrong password → correct password → existing route usable; sign out from overlay.
- [x] 4.3 Verify localStorage/sessionStorage/IndexedDB contain no unwrapped vault key after unlock and lock; the only session value is the non-sensitive failure counter.
- [x] 4.4 Document manual lock, local unlock, missing-material behavior, and deferred auto-lock in `README.md`.
- [x] 4.5 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm exec openspec validate vault-key-lifetime --strict`; verify all pass.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
- Defer idle timeout, settings, and visibility locking to `vault-auto-lock`.
