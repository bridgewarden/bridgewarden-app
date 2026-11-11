# Tasks

## 1. Preference store and decisions

- [x] 1.1 Add `auto-lock.ts` with `AutoLockPreferences`, defaults, allowed minute values, and a cached snapshot; verify invalid/missing storage returns 15 minutes and hide-lock off.
- [x] 1.2 Implement local persistence, subscription, and setters; verify changes notify subscribers and survive reload.
- [x] 1.3 Add `timeoutMs`, `isIdleExpired`, and `shouldLockOnVisibility`; verify boundaries and the `never` case.
- [x] 1.4 Verify the store contains only non-sensitive preference keys and no vault/key/token data.

## 2. Shell timer and visibility

- [x] 2.1 Wire the shell effect while unlocked: arm the timeout, track `lastActivity`, and call `lockVault()` on expiry.
- [x] 2.2 Reset the deadline on pointer, keyboard, touch, and passive scroll activity.
- [x] 2.3 Implement visibility handling: immediate lock when hidden + hide-lock, and expired check on return.
- [x] 2.4 Verify cleanup removes listeners and timers on lock, timeout change, and unmount.
- [x] 2.5 Verify manual lock, local unlock, five-failure logout, and protected-route gating are unchanged.
- [x] 2.6 Broadcast lock state to sibling tabs and reset preferences for a new authenticated session after an unauthenticated visit; verify both flows.

## 3. Settings UI

- [x] 3.1 Add `AutoLockCard` with a labelled timeout select and tab-hide checkbox backed by the preference store.
- [x] 3.2 Mount the card in account settings and add i18n strings for labels, options, and help text.
- [x] 3.3 Verify a settings change updates the active timer without reload and persists across reload; sign-out resets to the default policy.

## 4. Tests and documentation

- [x] 4.1 Add unit tests for defaults, invalid values, setters/subscriptions, timeout boundaries, idle expiry, and visibility decisions.
- [x] 4.2 Add E2E with a faked clock: select 1 minute, advance 60 seconds, observe the overlay, and unlock locally.
- [x] 4.3 Verify activity before the deadline postpones the lock.
- [x] 4.4 Verify hide-lock defaults off, enabling it persists, and the setting is reflected after reload.
- [x] 4.5 Document timeout options, default, activity reset, hide-lock scope, and non-sensitive storage in `README.md`.
- [x] 4.6 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm exec openspec validate vault-auto-lock --strict`; verify all pass.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
