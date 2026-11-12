# Tasks

## 1. Generator core

- [x] 1.1 Add the vendored EFF short wordlist with attribution and verify it contains 1,296 lowercase words.
- [x] 1.2 Implement themed password and passphrase generation with `crypto.getRandomValues`, rejection sampling, policy validation, per-set guarantees, and entropy metadata; verify unit tests for bounds, empty sets, ambiguous characters, and 10,000-sample policy checks.
- [x] 1.3 Add strength mapping and verify boundary tests at 39/40, 59/60, and 79/80 bits.

## 2. Generator preferences

- [x] 2.1 Bump the vault IndexedDB schema to v3 with a `meta` store and add validated read/write helpers; verify default fallback, corrupt-record fallback, round-trip, and v2-to-v3 upgrade tests.
- [x] 2.2 Verify sign-out removes generator preferences with the existing vault DB wipe.

## 3. Generator UI

- [x] 3.1 Add the protected `/app/generator` route and reusable generator feature with password/passphrase controls, strength display, regenerate, copy, and apply.
- [x] 3.2 Embed the panel in a dialog from the editor password field and verify applying a value updates the form without submitting.
- [x] 3.3 Persist option changes and verify they restore after reopening the generator.
- [x] 3.4 Add Playwright coverage for standalone generator, editor generate/apply, copy, policy toggles, and passphrase mode.

## 4. Client TOTP

- [x] 4.1 Add the client-safe TOTP library for Base32 normalization, `otpauth://` parsing, step calculation, and HMAC-SHA1 code generation; verify RFC 4226/6238 vectors and malformed/unsupported input.
- [x] 4.2 Refactor server account-TOTP verification to use the shared primitives without changing challenge tolerance; verify existing server TOTP tests still pass.
- [x] 4.3 Extend editor TOTP validation to accept raw Base32 and `otpauth://` URIs; verify inline invalid input still blocks save.

## 5. Clipboard, reveal, and item TOTP

- [x] 5.1 Refactor clipboard handling to cancel a previous timer, clear only when the clipboard still holds our value, expose pending-clear cleanup, and verify with fake-timer unit tests.
- [x] 5.2 Add the shared reveal hook with 30s timeout and reset on route change, lock, and window blur; verify with fake timers and unit tests.
- [x] 5.3 Load `{ password, totpSecret }` from one encrypted payload read when a login detail opens; verify no secret reaches storage, logs, URLs, or network.
- [x] 5.4 Render the item TOTP panel with grouped code, step-aligned countdown, copy, invalid-secret error, and cleanup on unmount/lock; verify the code rotates exactly at the boundary.
- [x] 5.5 Add Playwright coverage for TOTP display/rotation/copy, reveal auto-hide, and clipboard/reveal cleanup after lock and navigation.

## 6. Integration verification

- [x] 6.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`; verify all pass and `build/server/.dev.vars` is absent.

## Workflow follow-up

- Update `.agent/tasks/TASK-16.json`, `.agent/tasks.json`, and the PRD status after review if the project expects those mirrors to reflect completion.
- Archive the change after the project's review requirements are satisfied.
