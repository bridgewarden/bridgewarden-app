# Threat model

Bridgewarden is a zero-knowledge password manager deployed as one Cloudflare Worker with D1 and KV. The browser encrypts vault content; the server stores ciphertext and authentication material only.

## Assets

- Vault plaintext: item names, usernames, passwords, URLs, notes, custom fields, TOTP secrets, folder names.
- Client-only secrets: master password, derived master key, vault key, recovery secret, login wrap key.
- Authentication material: `auth_hash`, server salt, wrapped vault/recovery keys, session tokens, backup-code hashes.
- Second-factor material: encrypted TOTP seed and the plaintext seed while displayed during enrollment.
- Operational material: `AUTH_PEPPER`, `TOTP_ENC_KEY`, `SESSION_SECRET`, D1 snapshots, Worker secrets.

## Trust boundaries

```text
+-------------------------------+       +-------------------------------+
| Browser                        |       | Cloudflare edge               |
| - master password              | HTTPS | - TLS termination             |
| - master/vault/recovery keys   |------>| - WAF / Access (deployment)   |
| - plaintext vault projection   |       | - rate-limit binding          |
+---------------+---------------+       +---------------+---------------+
                |                                       |
                | ciphertext, auth hash, proofs          |
                v                                       v
+-------------------------------+       +-------------------------------+
| Worker                         |       | D1                             |
| - session and origin checks    |------>| - users, vault ciphertext      |
| - no vault decrypt path        |       | - audit, invitations, counts   |
| - TOTP seed decrypt exception  |       +-------------------------------+
+---------------+---------------+       +-------------------------------+
                |                       | KV                            |
                +---------------------->| - hashed session tokens        |
                                        | - hashed IP/UA fingerprints    |
                                        +-------------------------------+
```

The operator is trusted for availability and deployment, not for vault plaintext. A compromised browser, malicious extension, or exposed unlocked tab is outside the boundary.

## Server-visible fields

- `users`: id, email, display name, role, status, auth hash, server salt, KDF parameters, wrapped vault key and IV, wrapped recovery key and IV, recovery auth hash and salt, session version, vault revision, failure/lock counters, timestamps.
- `vault_items`: id, user id, type, folder id, favorite flag, ciphertext, IV, envelope version, revision, deleted time, timestamps.
- `folders`: id, user id, ciphertext name, IV, envelope version, revision, deleted time, timestamps.
- `user_2fa`: user id, encrypted seed and IV, enabled flag, last accepted TOTP step, pending-enrollment timestamp.
- `backup_codes`: user id, HMAC hash, usage marker.
- `audit_events`: event type, optional user subject, hashed IP/UA, allowlisted identifier metadata, timestamp.
- `setup_invitations`: email, display name, role, token hash, inviter, expiry, consumed marker.
- KV sessions: key is `sha256(token)`; value has user id, session version, timestamps, hashed UA/IP.

## Controls

- Vault encryption and decryption run only in the browser. The server has no item/folder decrypt path.
- Session authorization comes from the session cookie; item and folder ownership is checked server-side and foreign ids return 404.
- Mutations require same-origin JSON and bounded bodies; vault payloads are size-limited and strict.
- Envelope v2 authenticates item/folder row context with AES-GCM AAD. A fresh IV is generated per seal.
- Login, step-up, 2FA challenge, item creation, purge, health, and admin mutations use IP or identity rate limits; login and 2FA have independent lockout budgets.
- TOTP seeds are encrypted with a user-bound AAD. Backup codes are stored only as HMAC hashes.
- Item and folder quotas bound per-user storage. Scheduled cleanup retains a rev-stamped tombstone and writes a redacted per-user purge audit event.
- Logs contain request id, normalized route, status, duration, and a hashed user id only. Audit metadata is allowlisted.

## Non-guarantees and accepted trade-offs

- **Bearer sessions**: the session token is sufficient to act as the user. Stored UA/IP fingerprints are investigative metadata, not an enforced binding; comparing them would break legitimate network and mobile changes. A stolen token remains a bearer until logout, revocation, expiry, or session-version change.
- **Legacy envelope v1**: rows written before envelope v2 remain readable but are not bound to row id/type until re-saved. V2 ciphertext copied between rows fails authentication.
- **Compromised client**: JavaScript memory, clipboard contents, screenshots, and browser extensions cannot be protected after unlock.
- **Clipboard**: the app clears its own copied secret after 30 seconds and on lock/navigation when the clipboard still contains it; another application can change or read the clipboard first.
- **Recovery**: recovery intentionally bypasses 2FA and is audited. Loss of both the master password and recovery key is unrecoverable.
- **KV and rate limits**: KV is eventually consistent; rate-limit enforcement is per-location and eventually consistent. Edge WAF/Access policy remains deployment state.
- **Operator access**: an operator can read metadata and ciphertext, delete rows, or restore D1 snapshots. They cannot decrypt vault content from D1 alone.

## Deferred audit coverage decisions

| Surface               | Decision                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/prelogin` | IP-limited; known and unknown emails return the same parameter shape, with an HMAC-derived synthetic salt for unknown emails. Covered by `prelogin.test.ts`. |
| `POST /auth/logout`   | Same-origin JSON, server-side KV deletion, cookie clear, and audit. Idempotent without a session. Covered by `logout.test.ts`.                               |
| Admin mutations       | P2 adds IP and actor identity limits plus audited invitation revocation. Covered by admin route tests.                                                       |
| Client generator      | Uses `crypto.getRandomValues` with rejection sampling; preferences are non-secret IndexedDB metadata. Covered by generator tests.                            |
| Clipboard / reveal    | 30-second clear, lock and navigation cleanup, and reveal timeout. Covered by clipboard and reveal tests.                                                     |
| Companion-block sweep | Audit-process checklist, not runtime behavior. The deferred surfaces above were reviewed and either tested or accepted.                                      |

## Operational notes

Rotating `AUTH_PEPPER` invalidates all stored authentication hashes. Rotating `TOTP_ENC_KEY` makes existing TOTP seeds unreadable. Rotating `SESSION_SECRET` changes new session fingerprint keys; existing session tokens remain valid until revoked or expired. Keep secret backups offline and never place values in `wrangler.jsonc`, source, PRs, screenshots, or logs.
