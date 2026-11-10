# Tasks

## 1. TOTP primitives

- [x] 1.1 Add `app/lib/.server/totp.ts` with secret generation, RFC 4648 base32, current-step, otpauth URI, and ±1 verification; verify RFC 6238 SHA-1 vectors and adjacent-step acceptance
- [x] 1.2 Add replay helpers and constant-time six-digit comparison; verify reused/stale steps fail and malformed codes never throw

## 2. Seed encryption

- [x] 2.1 Add `app/lib/.server/totp-crypto.ts` deriving an AES key from `TOTP_ENC_KEY` with HKDF info `bw-totp`; verify round-trip, fresh IV, standard base64 storage, and user AAD binding
- [x] 2.2 Verify tampered ciphertext/IV and a mismatched user id fail decryption without leaking the seed

## 3. Enrollment APIs

- [x] 3.1 Add authenticated enroll use-case/route that generates a pending seed (`enabled=0`) and returns secret/URI once; verify unauthenticated calls are 401 and enabled users are refused
- [x] 3.2 Add verify use-case/route that validates the code, sets `enabled=1`, generates ten backup codes, and returns them once; verify invalid codes leave the factor disabled
- [x] 3.3 Add audit events for enrollment start, success, and failure; verify events contain no secret/code

## 4. Login challenge

- [x] 4.1 Refactor password login to check `user_2fa.enabled`, return only `{requires2fa:true, challengeToken}` when enabled, and never set a cookie/wrapped key before the second factor
- [x] 4.2 Add challenge KV storage/read/delete with five-minute TTL and attempt counts; verify expiry, missing/malformed tokens, and five-failure invalidation
- [x] 4.3 Add `/auth/2fa` use-case/route accepting TOTP or backup code, conditional `last_totp_step` update, session issuance, and wrapped-key response; verify concurrent reuse produces one success
- [x] 4.4 Share the login-completion helper between password-only and 2FA success paths; verify cookie/session/audit shape is identical

## 5. Backup codes

- [x] 5.1 Add `app/features/two-factor/.server/backup-codes.ts` with generation, Crockford normalization, HMAC hashing, conditional consumption, and regeneration; verify single use, old-code invalidation, and hash-only storage
- [x] 5.2 Add authenticated regenerate route returning ten new codes once; verify previous rows are replaced atomically

## 6. Disable and audit

- [x] 6.1 Add authenticated disable use-case/route verifying the submitted auth hash before deleting `user_2fa` and backup codes; verify wrong password leaves the factor enabled
- [x] 6.2 Add `2fa.*` audit events for verification, backup-code use, disable, and regeneration; verify no codes/hashes/tokens are stored

## 7. Settings and login UI

- [x] 7.1 Add `qrcode` and the `account-settings` feature with `/app/settings` under the protected layout; verify the route chunk renders and no external QR request occurs
- [x] 7.2 Build the disabled enrollment flow with secret/URI, local QR, six-digit verification, and one-time backup-code display with copy/download; verify keyboard and 360px behavior
- [x] 7.3 Build the enabled state with remaining-code count, regenerate, and password-confirmed disable; verify regeneration warning and error states
- [x] 7.4 Extend `/login` with a challenge state for TOTP/backup code, retaining the wrap key in memory and resetting on expiry/five failures; verify the button never blinks enabled mid-flow
- [x] 7.5 Add all new copy to `app/lib/i18n/en.ts`; verify typecheck catches missing keys

## 8. E2E and documentation

- [x] 8.1 Add a `two-factor` Playwright project after auth with trace/screenshots disabled; verify it can enroll, log out, complete a challenge, and disable to leave a repeatable state
- [x] 8.2 Add E2E coverage for enrollment, backup-code login, five failed attempts, and disabled 2FA fallback; verify `pnpm test:e2e` twice
- [x] 8.3 Document 2FA setup, backup-code handling, disable requirements, and the server-decryptable seed exception in README/threat notes; verify commands and warnings match

## 9. Integration verification

- [x] 9.1 Run typecheck, lint, format check, unit tests, E2E, build, and OpenSpec validation; verify all pass with counts recorded
- [x] 9.2 Grep new auth code for seed/code/token logging or responses; verify no secret after enrollment reaches logs, SSR HTML, cookies, storage, or audit metadata

## Workflow follow-up

- Run `/preflight` and fix every blocker before opening the PR.
- Open the GitHub PR with requirement IDs TASK-21, TASK-22, and TASK-23 and the security checklist.
- Archive the change after merge and verification.
