# Tasks

## 1. Dependencies and schema

- [x] 1.1 Add `idb` and `fake-indexeddb`; verify `pnpm install` succeeds and no Worker bundle imports Node-only code.
- [x] 1.2 Add `app/lib/vault/local-db.ts` with versioned stores `items`, `folders`, `keys`, `sync`, `meta`, `openVaultDb()`, and `wipeVaultDb()`; verify a fake-indexeddb upgrade test creates every store and index.
- [x] 1.3 Verify `wipeVaultDb()` clears all stores and is safe when the database has never been opened.

## 2. Cache layer

- [x] 2.1 Add `app/lib/vault/cache.ts` with put items/folders, read all items/folders, apply a delta page in one transaction, and tombstone handling; verify ciphertext rows round-trip unchanged.
- [x] 2.2 Verify no cache function imports crypto selectors, decryption, or the in-memory key store.
- [x] 2.3 Verify purged items with empty ciphertext persist as tombstones without breaking reads.

## 3. Wrapped key material

- [x] 3.1 Add key-material types and `storeKeyMaterial(email, material)`, `readKeyMaterial()`, and `clearKeyMaterial()`; verify only wrapped key, IV, KDF salt, and iterations are persisted.
- [x] 3.2 Verify storing a different email wipes all prior stores before the new record is written.
- [x] 3.3 Verify no plaintext password, master key, auth hash, or unwrapped vault key appears in any store.

## 4. Sync engine

- [x] 4.1 Add `app/lib/vault/sync.ts` that skips when offline, reads the stored watermark, applies pages, follows `nextCursor`, and commits `serverRev` only after the final page; verify with a fake API.
- [x] 4.2 Verify a failed middle page leaves the previous watermark and cache rows intact, and a retry re-applies idempotently.
- [x] 4.3 Add `subscribeSyncStatus()` and statuses `idle`, `syncing`, `offline`, `degraded`, `error`; verify subscribers receive transitions.
- [x] 4.4 Verify a delta applies item and folder tombstones and retains their deleted state.

## 5. Flow integration

- [x] 5.1 Persist key material after password login and 2FA success using the normalized email; verify cache is written only after unwrap succeeds.
- [x] 5.2 Persist key material after first-run setup and member setup using the account email from the flow/loader; verify setup redirects still work.
- [x] 5.3 Persist updated key material after recovery reset and master-password rotation; verify the previous wrapper/KDF record is replaced.
- [x] 5.4 Invoke `wipeVaultDb()` and `clearVaultKey()` after successful logout; verify no cache remains on the login screen.
- [x] 5.5 Trigger sync after unlock from the vault list container or app shell; verify it does not block first paint and stores status.

## 6. Degraded mode and tests

- [x] 6.1 Verify missing `indexedDB` or a failed open returns degraded status, keeps the app online-only, and never falls back to localStorage/sessionStorage.
- [x] 6.2 Add fake-indexeddb tests for cache, key material, sync pagination, failure, tombstone, wipe, and degraded mode.
- [x] 6.3 Add a test that inspects every store and asserts no plaintext item fields, password, auth hash, master key, or unwrapped vault key exists.
- [x] 6.4 Document the cache stores, sync watermark, logout wipe, and the explicit deferral of offline reload/outbox in `README.md`.
- [x] 6.5 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm exec openspec validate vault-local-cache --strict`; verify all pass.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
- Defer outbox/idempotent create to `vault-outbox`.
- Defer lock/unlock and offline reload to `vault-key-lifetime` and the PWA change.
