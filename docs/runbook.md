# Operational runbook

## Deploy order

1. Back up or verify D1 Time Travel retention.
2. Apply schema: `pnpm db:migrate:remote`.
3. Verify the remote migration list: `pnpm exec wrangler d1 migrations list bridgewarden-db --remote`.
4. Deploy: `pnpm deploy` (the deploy script refuses to upload while local migrations are pending).
5. Verify `GET /health?schema=1` returns the expected schema high-water mark and `ok: true`.

Never roll the Worker back below the applied schema high-water mark. If a rollback is required, keep the schema in place and deploy a build that understands the newer schema, or restore the D1 snapshot with the matching Worker version.

## Schema canary

`/health` remains an unauthenticated, rate-limited liveness probe. `/health?schema=1` additionally compares `d1_migrations` with the Worker's expected version. A 503 means the deployed code and schema are skewed; do not send user traffic until it is resolved.

## D1 recovery

Use Cloudflare D1 Time Travel or an operator-managed export. Document the chosen restore point, restore into a staging database first when possible, and verify the migration high-water mark before deploying the Worker.

## Secret rotation

`AUTH_PEPPER` and `TOTP_ENC_KEY` rotations are destructive: existing credentials or TOTP seeds cannot be verified after rotation. Back them up offline. Rotating `SESSION_SECRET` invalidates existing sessions but does not recover accounts. Never place secret values in `wrangler.jsonc`, source, PRs, screenshots, or logs.

## Envelope v2 compatibility

Existing v1 item and folder ciphertext remains readable. A row upgrades to v2 only when the client saves it again; there is no server-side bulk re-encryption. V2 authenticates the row identity and item type (`bw2:item:<id>:<type>` / `bw2:folder:<id>`), so copying v2 ciphertext between rows makes it undecryptable. Legacy v1 rows remain unbound until re-saved; do not treat the v2 binding as retroactive. Folder ids cannot be changed underneath existing v2 ciphertext.
