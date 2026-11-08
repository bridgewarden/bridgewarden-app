# Proposal

## Why

Password login is now complete, but one stolen master password still yields the vault. The schema and
required secrets for a second factor already exist; this change makes them usable so a password alone
cannot issue a session or return wrapped vault key material.

## What Changes

- Add RFC 6238 TOTP primitives (HMAC-SHA1, 6 digits, 30-second steps, 160-bit secret) with a ±1 step
  window and replay tracking through `last_totp_step`.
- Encrypt TOTP seeds at rest with AES-256-GCM under a key derived from `TOTP_ENC_KEY`; decrypt only
  during verification and never return the seed after enrollment.
- Add authenticated enrollment APIs and an `/app/settings` page: generate secret/otpauth URI and
  locally rendered QR, verify a code, enable 2FA, display ten backup codes once, regenerate codes,
  and disable with a re-verified master password.
- Split login: when 2FA is enabled, password verification returns a five-minute challenge token and
  no session or wrapped key; `POST /auth/2fa` accepts a TOTP or backup code and only then issues the
  session plus unlock material.
- Enforce five failed challenge attempts, conditional `last_totp_step` updates, and replay rejection.
- Add ten one-time backup codes in an unambiguous alphabet, stored only as HMAC-SHA256 hashes with
  `AUTH_PEPPER`; regeneration replaces all previous codes.
- Emit payload-free audit events for enrollment, verification, failures, backup-code use, disable, and
  regeneration.
- Add the client-side QR dependency `qrcode` and extend the login page with a challenge state.

## Capabilities

### New Capabilities

- `two-factor-auth`: TOTP enrollment and seed protection, login challenges, replay protection, and
  backup-code lifecycle.

### Modified Capabilities

- `user-auth`: login response and session issuance now depend on whether a second factor is enabled
  and successfully completed.

## Impact

- New server modules under `app/lib/.server/` for TOTP, seed encryption, challenge storage, and backup
  codes; new use-cases under `app/features/two-factor/.server/`.
- New API routes for enroll/verify/disable/regenerate and `/auth/2fa`, plus `/app/settings` with the
  `account-settings` feature.
- Login page and header/navigation updates for the challenge and settings entry.
- Existing `user_2fa` and `backup_codes` tables cover enrollment. Migration `0008` adds
  `two_factor_challenges` for atomic attempt counting and single-use challenge consumption.
- New dependency: `qrcode` (client-only route chunk).
- Out of scope: rate limiting/lockout, admin reset of another user's 2FA, passkeys, email OTP, and the
  other account-security sections planned for later PRs.
