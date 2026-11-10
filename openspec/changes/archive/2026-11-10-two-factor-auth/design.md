# Design

## Context

See `proposal.md` for motivation and `specs/two-factor-auth/spec.md` for behavior.

Current state:

- PR #9 provides password login, `requireUserApi`, session issuance, audit helpers, HMAC/base64
  helpers, and the in-memory vault key store.
- `user_2fa` and `backup_codes` already exist from migration `0004`. Migration `0008` adds the
  `two_factor_challenges` table so attempt counting and single-use consumption are atomic in D1.
- `TOTP_ENC_KEY` and `TOTP_ISSUER` are already configured in `.dev.vars` and Worker secrets.
- Login returns wrapped key material and a session immediately; the login page unwraps and navigates.
- There is no account-settings feature or route, and no QR dependency.

## Goals / Non-Goals

**Goals:**

- Prevent password-only login from issuing a session or returning wrapped key material when 2FA is on.
- Keep TOTP seeds server-decryptable but protected at rest and never returned after enrollment.
- Make replay and concurrent code use fail safely.
- Provide one-time backup codes and an explicit disable path.
- Keep the UI local: QR generated in the browser, no external service.

**Non-Goals:**

- Rate limiting, account lockout, admin reset, passkeys, email OTP.
- Changing vault crypto or storing vault data.
- Password change, recovery, or the rest of account settings (later PRs).

## Decisions

### D1. Login with 2FA returns only a challenge

`loginWithPassword` loads `user_2fa.enabled`. If false, it returns the current wrapped-key response
and creates the session. If true, it creates a challenge and returns
`{ requires2fa: true, challengeToken }` with no cookie and no wrapped key.

`POST /auth/2fa` returns the same wrapped-key response plus `Set-Cookie` after a valid TOTP or backup
code. Returning wrapped key material before the second factor would let a password-only attacker
brute-force the vault offline, so the split is mandatory.

### D2. TOTP primitives

`app/lib/.server/totp.ts` implements RFC 6238 with HMAC-SHA1, six digits, and 30-second steps:

- `generateSecret()` returns 20 random bytes.
- `encodeBase32`/`decodeBase32` use RFC 4648 uppercase without padding for the otpauth secret.
- `currentStep(now)` floors `now / 30_000`.
- `verifyCode(secret, code, lastStep)` checks `step-1`, `step`, and `step+1`, compares six-digit
  strings in constant time, and returns `{ valid, step }` only for `step > lastStep`.
- `buildOtpauthUri(secret, email, issuer)` returns
  `otpauth://totp/<issuer>:<email>?secret=...&issuer=...&algorithm=SHA1&digits=6&period=30`.

Secrets and codes are never logged.

### D3. Seed encryption at rest

`app/lib/.server/totp-crypto.ts` derives a 32-byte AES key with HKDF-SHA256 from `TOTP_ENC_KEY` and
info `bw-totp`. It encrypts the 20-byte seed with AES-256-GCM, a fresh 12-byte IV, and AAD
`totp:<userId>`, then stores standard base64 `totp_secret_ct` and `totp_secret_iv`. Decryption is
only called inside verification. Moving a ciphertext to another user fails because the AAD differs.

This is the documented zero-knowledge exception: the server must verify TOTP before the vault key
exists. The seed is never persisted client-side or returned after the initial enrollment display.

### D4. Enrollment lifecycle

- `POST /api/account/2fa/enroll` (session required) refuses when `enabled = 1`.
  It generates a secret, upserts a `user_2fa` row with `enabled = 0`, and returns `{ secret, uri }`
  exactly once.
- `POST /api/account/2fa/verify` (session required) decrypts the pending seed, verifies the code,
  sets `enabled = 1`, generates ten backup codes, replaces the old hashes, and returns the plaintext
  backup codes once.
- Re-enrollment while disabled overwrites the pending seed. Enabled users must disable first.
- The QR is rendered locally from the returned URI; the secret is shown as text for manual entry.

Alternatives rejected: enabling without backup codes (leaves no recovery path) and returning the
secret again on verify (violates “never returned after enrollment”).

### D5. Challenge storage and limits

`challenge:<sha256(token)>` is stored in `KV_SESSIONS` with
`{ userId, createdAt, expiresAt, attempts }` and a 300-second TTL. The token is 32 random bytes in
unpadded base64url. It is not stored in D1. A missing, expired, malformed, or fifth-failed challenge
is treated as invalid.

Each failed TOTP or backup code increments `attempts`. The fifth failure deletes the KV record. A
challenge also stores no vault material; the client keeps only the password-derived wrap key in
memory until the challenge succeeds.

### D6. Replay and session issuance

For TOTP, the accepted step is written with a conditional update:

```sql
UPDATE user_2fa
SET last_totp_step = ?, updated_at = ?
WHERE user_id = ? AND last_totp_step < ?
```

Only `meta.changes === 1` proceeds. This makes concurrent reuse of the same code fail even when both
requests verified before the write. Then the shared login-completion helper creates the session with
the current user `session_version`, UA/IP fingerprints, and returns the wrapped key response. The
session is not created in D1, so the conditional D1 update is the replay gate and the KV session is
created after it.

### D7. Backup codes

`app/features/two-factor/.server/backup-codes.ts`:

- Generates ten 10-character codes from the Crockford alphabet (no I/L/O/U), displayed grouped as
  `XXXXX-XXXXX`.
- Normalizes input by uppercasing and stripping separators.
- Stores `HMAC-SHA256(AUTH_PEPPER, normalizedCode)` as hex in `backup_codes.code_hash`; only hashes
  and `used_at` are persisted.
- Consumes with
  `UPDATE backup_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL`
  and requires `meta.changes === 1`.
- Regenerates with a D1 batch that deletes all user hashes and inserts ten new ones.

A global unique hash constraint is retained. The UI shows the plaintext codes once with copy/download
and warns that regeneration invalidates old codes.

### D8. Disable with master password

The settings page asks for the current master password, calls `/auth/prelogin` for the signed-in
email, derives `authHash` locally, and posts it to `POST /api/account/2fa/disable`. The server verifies
it with the stored pepper/salt before deleting `user_2fa` and all backup codes. Password and derived
keys are cleared after the request. Requiring a TOTP code instead would lock out users who lost their
authenticator, and an admin reset is out of scope.

### D9. Routes and guards

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /auth/2fa` | challenge token | Verify TOTP/backup and issue session |
| `POST /api/account/2fa/enroll` | session | Start enrollment |
| `POST /api/account/2fa/enroll` | session + auth hash | Create pending seed, return secret/URI once |
| `POST /api/account/2fa/verify` | session | Enable + return backup codes |
| `POST /api/account/2fa/disable` | session + auth hash | Disable and delete data |
| `POST /api/account/2fa/backup-codes/regenerate` | session + auth hash | Replace and return ten codes |
| `GET /app/settings` | session | Settings page |

All POSTs use the PR #9 same-origin and 256 KiB JSON guard. Account APIs use `requireUserApi` and
return 401 JSON. `/auth/2fa` additionally validates the challenge before touching TOTP data.

### D10. Settings UI and QR

Add the `account-settings` feature and `/app/settings` under the protected layout. The page renders a
2FA card with states: disabled, pending enrollment (secret/URI/QR + verify), enabled (backup-code
count, regenerate, disable), and one-time backup-code display.

Use the browser build of `qrcode`, dynamically imported inside the QR effect, to paint a canvas from the
otpauth URI; no external QR service and no secret outside the local component state. The header user
menu gains a settings link.

### D11. Login page challenge state

The login page keeps the password-derived wrap key in memory. When `/auth/login` returns
`requires2fa: true`, it switches to a challenge step with a TOTP input and a backup-code toggle,
retaining the wrap key. `/auth/2fa` success returns wrapped key material; the page unwraps and
navigates exactly as the password-only path does. Five failures or an expired challenge clear the
wrap key and return to the credentials step. The button uses one flow-active state to avoid the
disabled/enabled blink fixed in PR #9.

### D12. Audit events

Add `2fa.enrollment_started`, `2fa.enrolled`, `2fa.enrollment_failed`, `2fa.challenge_issued`,
`2fa.verified`, `2fa.failed`, `2fa.backup_code_used`, `2fa.disabled`, and
`2fa.backup_codes_regenerated` through `recordAuditEventSafe`. Events carry userId and peppered UA/IP hashes only; no seeds, codes, hashes,
or challenge tokens.

### D13. E2E ordering

The existing projects run `smoke` → `setup` → `auth`. The auth spec logs out at the end, leaving the
admin with no session and no 2FA. Add a `two-factor` project after `auth` that signs in, enrolls
(TOTP secret/backup codes are test-only), logs out, completes a challenge, verifies `/app`, then
disables 2FA so the suite is repeatable. Trace and screenshots stay disabled for all projects that
type secrets.

### D14. Challenge migration

`user_2fa` and `backup_codes` already contain every column. Migration `0008` adds
`two_factor_challenges` with an atomic attempt counter and a `consumed_at` marker, so parallel guesses
cannot exceed the cap and a successful challenge cannot be resurrected by a late failure write.

### D15. Rate limiting remains deferred

Challenge attempts are capped at five, but route-level rate limiting, lockout counters, and admin
reset remain PR #11/PR #12 scope.

## Risks / Trade-offs

- [Server-decryptable TOTP seed] → Documented zero-knowledge exception; the seed is AES-GCM encrypted
  with a server secret, AAD-bound to the user, and never returned after enrollment.
- [TOTP brute force] → Six digits with a ±1 window is weak without limits; five challenge failures
  invalidate the token, and route rate limiting follows in PR #11.
- [Challenge theft before second factor] → Five-minute TTL, opaque token, hashed D1 storage with an
  atomic single-use marker, and no vault material in the challenge response.
- [Clock skew] → ±1 step window and `last_totp_step`; a client clock outside 30 seconds may fail.
- [Backup-code loss] → Codes are shown once; regeneration is explicit and invalidates old codes.
- [QR dependency] → The `qrcode` browser build is dynamically imported only in the settings effect; no
  external request is made.
- [E2E repeatability] → The 2FA project disables the factor at the end and resets state through the
  existing isolated database setup.

## Migration Plan

1. Apply migration `0008`, then deploy the code and `qrcode` dependency.
2. Users opt in from `/app/settings`; existing accounts keep password-only login.
3. Rollback: revert the code; existing `user_2fa`/`backup_codes`/`two_factor_challenges` rows are
   harmless and can be removed manually.

## Open Questions

None blocking. Rate limiting and admin reset remain later PRs.
