# Bridgewarden — Project Summary

**What it is:** Zero-knowledge password manager for personal/family use, deployed entirely on Cloudflare as a single React Router v8 Worker with D1 + KV. Vault is encrypted/decrypted in the browser; the server only ever holds ciphertext.

## Main features (MVP)
- First-run setup wizard (bootstrap token, works only while the user table is empty)
- Master password login derived via PBKDF2-SHA256 600k, plus TOTP 2FA and one-time backup codes
- Login items and secure notes with folders, favorites, and custom fields
- Password generator and RFC 6238 TOTP code generator for items
- Client-side search, trash/restore/purge, auto-lock (default 15 min)
- Encrypted IndexedDB cache so the vault works offline
- Admin panel: create/disable users, revoke sessions (no email delivery)
- Change master password (rewrap only) and recovery-key reset flow

## Key user flows
1. **Setup:** bootstrap token → account → master password → recovery key confirmation → 2FA → unlocked vault.
2. **Login:** derive auth hash client-side → server verify + pepper → optional 2FA → unwrap vault key → load cache → sync deltas.
3. **Item lifecycle:** create/edit → encrypt → optimistic cache + outbox → API with `rev` → 409 on conflict.
4. **Lock:** idle timeout discards the vault key in memory; unlock re-derives locally, no server call.
5. **Offline:** reads from cache, writes queue in outbox, flush on reconnect.

## Key requirements
- Server stores no plaintext vault fields — only ciphertext plus metadata (type, folder, timestamps, rev).
- AES-256-GCM with versioned envelope; random 96-bit IV per encryption; HKDF domain separation for auth/wrap/recovery.
- Recovery key is client-only; the server can never recover a vault.
- Session = opaque token in httpOnly/Secure/SameSite=Lax cookie, hashed in KV.
- Nonce-based CSP, no third-party scripts, no plaintext logging.
- WCAG 2.1 AA; initial JS < 200KB gzip; unlock < 1s p95.
- Vault data must never be embedded in SSR HTML.

## Explicit non-goals (MVP)
Sharing/organizations (schema seeded, phase 2), attachments, import/export, Send, browser extension, Android, passkeys, email, public registration.

## Stack
React Router v8 (framework, SSR) + Cloudflare Vite plugin · Workers · D1 · KV · Rate Limiting binding · R2 reserved · Tailwind + shadcn/ui · WebCrypto · Vitest + Playwright · pnpm · Node 24 · Wrangler 4.

## Docs
- Full PRD: `.agent/prd/PRD.md`
- Task list: `.agent/tasks.json` (generated separately)
- Env placeholders: `.env.local` (mirror to `.dev.vars`); fill secrets manually.
