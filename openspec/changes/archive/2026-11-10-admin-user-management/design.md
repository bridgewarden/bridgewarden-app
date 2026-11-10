# Design

## Context

See `proposal.md` — Why. Constraints:

- `users` requires non-null auth and wrapped-key columns, so an invited user cannot be inserted before key setup.
- D1 has no interactive transaction; multi-statement writes use `db.batch()` with guarded SQL.
- Features never import another feature; setup key generation currently lives under `features/setup`.
- The existing rate-limit helper can be reused for `/setup/member`.
- Sessions are KV-backed; D1 `session_version` is authoritative.

## Goals / Non-Goals

**Goals:**

- Provision members without email and without admin-visible secret material.
- Make invitation consumption and user creation atomic.
- Enforce admin authorization and last-active-admin protection in SQL.
- Keep admin actions audit-friendly and non-destructive by default.

**Non-Goals:**

- Email delivery, password reset, 2FA reset, or account deletion.
- Self-service registration.
- Organization membership or roles beyond admin/member.
- KV invitation tokens; D1 is used because it supports atomic consumption.

## Decisions

### D1. Invitation-first provisioning

`0009_setup_invitations.sql` adds:

```text
setup_invitations(
  id, email UNIQUE, display_name, role, token_hash UNIQUE,
  invited_by_id, expires_at, consumed_at, created_at
)
```

- Admin create inserts/upserts a pending invitation, not a user.
- Admin list merges `users` with pending invitations.
- Member acceptance creates the user with real credential material.
- No placeholder user, no nullable auth columns, no schema rebuild.

Alternative considered: insert a disabled placeholder user with random credentials and a `setup_pending` flag. Rejected because it leaves orphan accounts, complicates login, and consumes the email before setup.

### D2. Invitation tokens are D1-backed and hashed

Generate a 32-byte random token, return the raw token once, and store only `SHA-256(token)`. TTL is 24 hours. D1 is chosen over KV because accepting an invitation needs an atomic consume-and-create operation; KV has no atomic get-and-delete.

### D3. Acceptance is one guarded D1 batch

After validating the invitation and generating user material:

```sql
-- 1
UPDATE setup_invitations
SET consumed_at = :consume_marker
WHERE token_hash = :hash AND consumed_at IS NULL AND expires_at > :now;

-- 2
INSERT INTO users (...)
SELECT ...
WHERE EXISTS (
  SELECT 1 FROM setup_invitations
  WHERE token_hash = :hash AND consumed_at = :consume_marker AND expires_at > :now
);
```

The invitation update and user insert are one `db.batch()`. `consume_marker` is a per-request unique integer (millisecond timestamp plus random suffix) so only statements from the same batch see the guard as true; both batch results must report one changed row. If the update loses a race, the insert is a no-op. If the insert fails (for example email uniqueness), the batch rolls back the consumption.

A session is created before the D1 batch, following the bootstrap pattern, and destroyed if the batch fails.

### D4. Admin authorization is a session role check

`requireAdmin(request, env)` calls `requireUser`/session resolution and requires `role === 'admin'`. Admin page requests without a session redirect to login; authenticated non-admins get 403. Admin mutations use the API variant with 401 for no session and 403 for wrong role.

### D5. Last-admin protection is encoded in the update

Disable and demote use guarded SQL:

```sql
UPDATE users
SET status = 'disabled', session_version = session_version + 1, updated_at = :now
WHERE id = :id
  AND (role != 'admin' OR (
    SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'
  ) > 1);
```

`meta.changes = 0` means not-found or last-admin. No read-then-write sequence. Role changes use the equivalent guard. This is atomic and avoids holding a transaction across two statements.

### D6. Admin routes are one operation per URL

- `admin.users.tsx` — page + loader only
- `admin.users.invite.tsx` — create invitation
- `admin.users.$userId.disable.tsx`
- `admin.users.$userId.enable.tsx`
- `admin.users.$userId.revoke.tsx`
- `admin.users.$userId.role.tsx`

Each mutation has one schema and one action. All are under the protected layout.

### D7. Shared setup key material moves to app/lib

`features/setup/setup-keys.ts` moves to `app/lib/crypto/setup-keys.ts`. Both first-admin setup and member setup import it. The module remains client-only and contains no React.

### D8. Member setup uses the existing auth rate limiter

`/setup/member` applies `limitIp(env, 'member-setup', request)` before reading the body. Over-budget returns 429 and does not consume the invitation.

## Risks / Trade-offs

- [Raw setup token in a URL] → show it once, no-store the page, never log or audit it; token is single-use and expires in 24 hours.
- [Invitation email conflicts with a concurrent user creation] → unique constraints and batch rollback; return 409.
- [Admin list merges two sources] → query users and pending invitations separately in one loader; no pagination in MVP.
- [Last-admin SQL guard may feel opaque] → return 409 with a stable `last-admin` error and cover both disable and role change with tests.
- [Admin create link is lost if the admin closes the panel] → the raw token cannot be recovered; the admin can replace the pending invitation, which rotates the token.
- [D1 invitation deviates from the old KV note] → recorded here because atomic single-use is required.

## Migration Plan

1. Apply `0009_setup_invitations.sql`.
2. Deploy admin/member routes and the shared setup-key module.
3. No data backfill; existing users are unaffected.
4. Rollback: revert code and drop the invitation table if empty; consumed invitations are historical only.
