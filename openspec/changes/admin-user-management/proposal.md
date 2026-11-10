# Proposal

## Why

The only account that can exist today is the first administrator created by `/setup`. There is no way for that administrator to provision family members, disable an account, or revoke a suspicious session without direct database access. TASK-25 requires an admin-only user management surface and a passwordless-email-free onboarding path.

The old TASK-10 description suggested inserting an active user without vault material. The existing schema makes that impossible because authentication and wrapped-key columns are `NOT NULL`. This change uses an invitation-first model instead: the admin creates a one-time setup invitation, and the member creates their own user row with client-derived keys when accepting it.

## What Changes

- Add migration `0009_setup_invitations.sql` with a `setup_invitations` table:
  - email, display name, role, hashed token, inviter, expiry, consumption marker.
- Add an admin guard that requires an authenticated `role = 'admin'` session.
- Add admin routes and UI under `/admin/users`:
  - list users and pending invitations;
  - create invitation (email, display name, role);
  - disable/enable user;
  - revoke all sessions;
  - change role with last-active-admin protection.
- The create action returns a one-time setup link `APP_ORIGIN/setup/member?token=...`; no email is sent and the raw token is shown once.
- Add `/setup/member` member setup:
  - validate an unexpired, unconsumed invitation;
  - collect master password, confirmation, and recovery key confirmation;
  - generate vault/auth/recovery material in the browser;
  - consume the invitation and insert the user atomically in D1;
  - issue a session after successful setup.
- Extract client key-material generation from the setup feature to `app/lib/crypto/setup-keys.ts` so `setup` and `member-setup` share it without importing another feature.
- Disabling a user sets `status='disabled'` and increments `session_version`, invalidating existing sessions.
- Add an admin navigation link for administrators.
- Emit payload-free audit events for invitation creation, member setup, role changes, disable/enable, and session revocation.

## Capabilities

### New Capabilities

- `admin-users`: admin-only user listing, invitations, status changes, role changes, and session revocation.
- `member-setup`: one-time invitation acceptance and member key setup without admin-visible secrets.

### Modified Capabilities

- `data-model`: adds durable storage for pending setup invitations.
- `app-shell`: adds admin-only navigation to the user management page.

## Impact

- New migration `0009_setup_invitations.sql`.
- New `app/features/admin-users/`, `app/features/member-setup/`, and admin/member routes.
- New invitation query module and admin-guard helper.
- `app/lib/crypto/setup-keys.ts` replaces the feature-local setup key module.
- No email delivery, external service, or dependency.
- Existing first-admin bootstrap, login, 2FA, and rate limiting remain unchanged.
