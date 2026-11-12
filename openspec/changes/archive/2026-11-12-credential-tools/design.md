# Design

## Context

See `proposal.md` for motivation. The vault editor and detail already handle encrypted items; `app/lib/base32.ts` and `app/lib/.server/totp.ts` already implement Base32 and HMAC-SHA1 for account 2FA; `app/lib/clipboard.ts` already performs a best-effort 30s clipboard clear. This change adds the user-facing credential tools and makes those shared behaviors safe and reusable.

Constraints:

- Item TOTP secrets and generated passwords are plaintext only in memory.
- The server must never receive an item TOTP secret or generated code.
- Generator preferences contain no secrets.
- The app must continue to work on browsers that deny clipboard read.
- The generator must work while no vault item is open; it does not need the vault key.

## Goals / Non-Goals

**Goals:**

- Pure, testable CSPRNG password and passphrase generation.
- Reusable generator panel and a protected standalone page.
- One client TOTP implementation shared with server verification primitives.
- One clipboard timer and one reveal lifecycle used by generator, editor, and detail.
- Tests for policy, RFC vectors, timers, and UI flows.

**Non-Goals:**

- QR scanning, server-side item TOTP, trash UI, new item payload fields, or third-party OTP/password libraries.
- Persisting generated values, TOTP codes, or reveal state.

## Decisions

### Pure generator core with rejection sampling

Add `app/lib/generator.ts` with password and passphrase functions. Random indices use `crypto.getRandomValues` and rejection sampling, never modulo reduction or `Math.random`.

Password options: length 8-64, four character sets, exclude-ambiguous. Generation selects one character from every enabled set, fills the remainder, and shuffles with unbiased random indices. An empty set selection, invalid length, or invalid passphrase count throws a typed policy error.

Passphrase options: 3-6 words, separator, capitalize. The wordlist is a vendored EFF short list (1,296 words) in `app/lib/passphrase-words.ts` with attribution. No runtime fetch and no third-party package.

### Entropy-based strength

Return `entropyBits` with every generated value:

- password: `length * log2(alphabet size)`
- passphrase: `words * log2(wordlist size)`, plus separator entropy when the separator is randomized

Map to weak (<40), fair (<60), strong (<80), very strong (>=80). The UI displays the label and a progress indicator using semantic tokens. Strength is derived from policy, not from the generated string.

### Reusable panel and protected page

Add `app/features/generator/` with a page entry, panel component, and small feature-suffixed helpers. Add `/app/generator` inside the protected layout.

The panel is used in two places:

- standalone page
- dialog opened by a Generate icon next to the editor password field

The editor receives an `onGenerated` callback; applying a value updates form state only and does not submit. The panel includes a link to the standalone page. No header navigation change is needed for this capability.

### Preferences in IndexedDB meta store

Bump `VAULT_DB_VERSION` from 2 to 3 and add:

```ts
meta: { key: string; value: { key: 'generator'; preferences: GeneratorPreferences } }
```

`generator-prefs.ts` reads and validates the record, falls back to defaults, and writes only generator options. The DB is already wiped on logout. IndexedDB unavailable means defaults, not a blocking error.

### Shared TOTP primitives

Add `app/lib/totp.ts` with Base32 normalization/decoding, `currentTotpStep`, `generateTotp`, and `parseTotpSecret`.

Parsing accepts normalized raw Base32 and `otpauth://totp` URIs. URI values for algorithm, digits, and period are validated as SHA1/6/30 when present. Typed errors distinguish malformed Base32 from unsupported parameters.

Refactor `app/lib/.server/totp.ts` to use the shared step/HMAC primitives while keeping server verification semantics, including its existing tolerance. Item TOTP display never uses server verification tolerance; it displays the current step only.

### Item detail loads the secret on open

The list container owns a `loadItemSecrets(id)` callback backed by `readVaultItem`. The detail receives the callback and loads `{ password, totpSecret }` once when a login detail opens. It keeps both in component memory only.

If the secret parses, render a TOTP section with grouped code, countdown, and copy. If parsing fails, show an inline error. The timer is one timeout aligned to the next step boundary, cleared on unmount/lock. A generation counter prevents an older HMAC result from overwriting a newer step.

This is one full payload read per detail open, required because the TOTP seed lives inside the item envelope. No plaintext is written to storage or sent to the server.

### One clipboard lifecycle

`app/lib/clipboard.ts` owns a module-level pending-clear timer. Every copy:

1. cancels the previous timer;
2. writes the new value;
3. schedules a 30s read-back and clears only when the clipboard still holds our value.

`clearSecretClipboard()` clears pending state. The helper returns whether manual clearing may be required; the toast always includes a manual-clear hint. Lock and route transition call cleanup.

### One reveal hook

Add `app/hooks/use-secret-reveal.ts`:

- returns `revealed`, `reveal`, `hide`;
- resets after 30s;
- resets on `useLocation` change, vault lock subscription, and `window.blur`;
- keeps no persisted state.

Use it in both item detail and editor password fields. Remove local reveal state.

### Editor TOTP validation

The editor's `isValidTotpSecret` accepts both raw Base32 and `otpauth://` URIs by calling the shared parser. Invalid input is inline; a valid URI is stored as the encrypted value without normalization that would lose parameters.

## Risks / Trade-offs

- **Full payload read on detail open** -> only while detail is open; state is component-local and cleared on unmount. Password copy still loads through the same single read.
- **Wordlist size and bundle** -> the EFF short list is static and only imported by the generator feature; it does not affect the vault route chunk.
- **Clipboard verification is permission-dependent** -> show a manual-clear hint and never claim a guaranteed clear.
- **TOTP clock drift** -> use the same 30s step calculation as the server; display the current step without server tolerance.
- **DB schema bump** -> additive `meta` store; existing stores remain readable and migration is forward-only.

## Migration Plan

- Upgrade IndexedDB from v2 to v3 by adding only the `meta` store.
- Existing ciphertext, outbox, sync, and key records are unchanged.
- Rollback is safe because the generator preferences are non-critical; older code ignores the new store.

## Open Questions

None. The generator is protected inside the vault shell; item TOTP loads on detail open because the secret is inside the encrypted envelope.
