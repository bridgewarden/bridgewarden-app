# Design

## Context

See `proposal.md` - Why. The vault API already returns ciphertext deltas with `serverRev`, `nextCursor`, and tombstones. The client has an in-memory key store (`app/lib/vault/key-store.ts`) but no IndexedDB layer, no key-material cache, and no client sync. Login, setup, member setup, recovery, and password rotation all derive or receive wrapped key material in the browser, but none of them persist it.

The app is SSR; a reload without network cannot load a document until the later PWA change. This design caches data for the running app and future offline mutation work, but does not claim offline reload.

## Goals / Non-Goals

**Goals:**

- Persist ciphertext items/folders and wrapped key material across page sessions.
- Resume sync from `serverRev` and `nextCursor`.
- Apply tombstones deterministically.
- Wipe all local data on logout/account switch.
- Degrade to online-only when IndexedDB is unavailable.
- Expose sync/cache status for later UI.

**Non-Goals:**

- Outbox, optimistic mutations, conflict replay.
- Lock/unlock provider or auto-lock (TASK-37/TASK-28).
- Offline reload, service worker, PWA.
- Decrypted selectors or vault UI.
- Server API changes.

## Decisions

### Use `idb` with an explicit versioned schema

Add `idb` as a runtime dependency and `fake-indexeddb` for tests. Database `bridgewarden-vault` version 1:

```text
items    keyPath id
folders  keyPath id
keys     keyPath 'active'      (email, vaultKeyWrapped, vaultKeyWrapIv, kdfSalt, kdfIterations, storedAt)
sync     keyPath 'active'      (serverRev, cursor)
```

Why `idb` rather than hand-written IDB: typed schema, transaction helpers, and upgrade handling with a very small footprint. Why not localStorage: synchronous, XSS-friendly, and unsuitable for ciphertext sets.

### Cache only ciphertext and metadata

`cache.ts` accepts API rows and stores them verbatim in their ciphertext/transport form. No decryption helper is called in the cache layer. Tombstones remain as rows with `deletedAt`; purged items may have empty ciphertext. A separate future selector layer can decrypt into component scope using `getVaultKey()`.

### Single active key-record with email ownership

The login response does not expose a user id, and every flow already has the normalized email. `keys` has one record keyed `active`, containing the email and wrapped key/KDF. `storeKeyMaterial(email, material)` reads the current record and wipes every store when the owner is missing or different, then writes the new record with `storedAt`. Records older than 30 days or outside the KDF iteration bounds are treated as absent. The unwrapped vault key is never written.

### Integrate at every unlock boundary

Call the cache helper after successful:

- password login and 2FA challenge;
- first-run setup;
- member setup;
- recovery reset;
- master-password rotation (replace wrapper/KDF).

The login success effect already has the unwrapped key and response material. Setup/member/recovery/password flows already hold the transport material. Email is available from the login form, setup state, member loader, recovery form, and settings props.

### Sync engine applies pages, commits the watermark last

`syncVault()`:

```text
require unlocked key + active key record
if offline -> status offline, return
watermark = sync.serverRev ?? 0
cursor = sync.cursor
capture database epoch
loop:
  response = GET /api/vault?since=watermark&cursor=cursor
  apply items/folders in one read-write transaction
  if nextCursor: persist {serverRev: watermark, cursor}; continue
  write serverRev = response.serverRev; clear cursor; break
```

If a page fails, the persisted cursor resumes at the failed page while the watermark stays at the last complete sync. Writes are rejected when a logout wipe changes the database epoch in the middle of a sync. Only a complete loop advances the watermark. A module-level subscriber list powers `subscribeSyncStatus()`; statuses are `idle`, `syncing`, `offline`, `degraded`, `error`.

### Apply tombstones, never delete silently

Items/folders with `deletedAt` are stored as tombstones. Purged items may be empty ciphertext; the cache preserves their tombstone metadata until a later cleanup policy. Sync uses a single transaction per page.

### Wipe on logout and account switch

`wipeVaultDb()` is serialized with database opens, increments an epoch, closes the connection, and deletes the database; `clearVaultKey()` zeroes memory. Logout awaits the wipe before navigating. A successful login for a different or missing owner wipes before storing the new material.

### Degraded mode

`openVaultDb()` rejects with `VaultDbUnavailableError` when `indexedDB` is missing; sync maps that to `degraded` and leaves the app online-only. Other database errors surface as `error`. There is no localStorage fallback.

## Risks / Trade-offs

- **Ciphertext storage can stale** -> watermark only advances after a complete sync; next sync re-fetches.
- **Key material cache by email** -> changing email before cache write could orphan data; account switch wipes before write.
- **Shared browser profile** -> wrapped keys are ciphertext, but lock/logout wipe still required; key lifetime follows in TASK-37.
- **IndexedDB private mode** -> degraded online-only path; no silent plaintext fallback.
- **No offline reload** -> explicitly deferred to PWA; the cache still supports in-session offline reads and future offline mutations.
- **No outbox yet** -> mutations still server-first; this change only provides the cache/sync foundation.

## Migration Plan

1. Add dependencies and local DB modules.
2. Wire key-material persistence into all unlock flows and wipe into logout.
3. Start sync from the vault list container / app shell after unlock.
4. Verify cache contents contain no plaintext or raw key with fake-indexeddb tests.
5. Rollback by removing the cache calls and dependency; server data is unaffected.

## Open Questions

None. Outbox and offline reload are separate changes.
