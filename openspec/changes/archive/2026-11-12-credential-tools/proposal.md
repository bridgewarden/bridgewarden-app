# Proposal

## Why

The vault can store credentials but cannot generate them, show live TOTP codes for saved items, or safely manage copied and revealed secrets. TASK-16 closes that daily-use gap with a CSPRNG generator, RFC 6238 item codes, and one clipboard/reveal lifecycle.

## What Changes

- Add CSPRNG password and passphrase generation with policy validation, entropy-based strength, and no `Math.random`.
- Add a reusable generator panel, a protected `/app/generator` page, and a Generate action in the login password field.
- Persist non-sensitive generator preferences in the local vault meta store; support defaults when IndexedDB is unavailable.
- Add a client-safe RFC 6238 TOTP library for raw Base32 and `otpauth://` secrets.
- Show a rotating TOTP code, countdown, and copy action in item detail for login items with a valid secret.
- Reuse one clipboard lifecycle: copy, 30s best-effort clear, cancel previous clear on a new copy, manual-clear hint when verification is unavailable, and cleanup on lock/route change.
- Reuse one reveal lifecycle: 30s auto-hide, reset on route change, lock, and window blur.
- Extend editor TOTP validation to accept both raw Base32 and `otpauth://` input.
- Exclude QR scanning, server-side item TOTP, trash UI, and payload schema changes.

## Capabilities

### New Capabilities

- `credential-tools`: password and passphrase generation, client TOTP codes for stored items, and clipboard/reveal safety.

### Modified Capabilities

None.

## Impact

- New generator core, wordlist, preference store support, client TOTP library, reveal hook, generator feature, and route.
- New `meta` object store in the vault IndexedDB database.
- Item detail loads the encrypted payload on open to display TOTP and expose password actions; no plaintext is persisted.
- Editor password and TOTP fields, app routes, i18n catalog, unit tests, and Playwright coverage.
- No API, database migration, new runtime dependency, or server-side TOTP change.
