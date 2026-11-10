# Design

## Context

See `proposal.md` — Why. Current constraints:

- `RATE_LIMITER` exists in `wrangler.jsonc` at 60 requests/minute, but nothing calls it.
- `failed_login_count` and `locked_until` already exist on `users`.
- Login verifies a client-derived `authHash`; there is no plaintext password server-side.
- Auth routes are `/auth/login`, `/auth/prelogin`, `/auth/2fa`, and `/setup`; `/auth/recover` does not exist yet.
- D1 queries must stay inside `queries/` modules; multi-statement writes use `db.batch()`.

## Goals / Non-Goals

**Goals:**

- Reject abusive auth traffic with a stable 429 contract.
- Make account lockout authoritative in D1, independent of edge-local rate limiting.
- Keep raw IPs and emails out of rate-limit keys.
- Preserve generic responses for unknown accounts.

**Non-Goals:**

- Admin user management or setup tokens.
- Recovery route implementation.
- CAPTCHA, WAF rules, or global per-tenant quotas.
- Storing per-attempt history; only counters and deadlines are persisted.

## Decisions

### D1. Two rate-limit bindings with different budgets

Use separate bindings:

```text
RATE_LIMITER_IP       60 requests / 60s   per hashed IP
RATE_LIMITER_IDENTITY 20 requests / 60s   per hashed account identity
```

- Login consumes both `login:ip:<hash>` and `login:email:<hash>`.
- Prelogin and setup consume only the IP binding.
- 2FA consumes `2fa:ip:<hash>` and `2fa-user:identity:<hash>` after reading the challenge to resolve the account.
- A 2FA challenge identity is available before code verification, so it is a safe key.

The 20-request identity budget sits above the ten-failure lockout threshold, so the eleventh attempt reaches the lockout gate and returns 423; the larger IP budget avoids blocking unrelated accounts behind one account. The existing single `RATE_LIMITER` binding is replaced by these two.

Alternative considered: one binding at 10/minute for every key. Rejected because one noisy account would consume the shared IP budget and block unrelated accounts during normal use.

### D2. Rate-limit keys are HMACs

`app/lib/.server/rate-limit.ts` exposes:

```ts
limitIp(env, scope, request): Promise<{ allowed: boolean; retryAfter: number }>
limitIdentity(env, scope, value): Promise<{ allowed: boolean; retryAfter: number }>
```

Keys are `HMAC-SHA256(AUTH_PEPPER, '<scope>:ip:<value>')` and `<scope>:identity:<value>` rendered as hex. Emails are normalized before hashing; case-sensitive values such as challenge-derived ids are hashed verbatim. The raw value is never stored, logged, or returned. `retryAfter` is the binding period in seconds.

If the pepper is missing, the request fails closed with 500 rather than bypassing the limiter.

### D3. Rate limiting belongs to the transport routes

Routes parse the request, apply the relevant limits, then call the use-case. This keeps login lockout and rate limiting independent:

- `auth-login.ts`: parse JSON + `LoginInput`, limit IP and email, then call `loginWithPassword`.
- `auth-prelogin.ts`: parse email, limit IP.
- `auth-2fa.ts`: parse challenge input, limit IP and challenge token hash.
- `routes/setup.tsx`: after mutation parsing, limit IP before the setup use-case.

A rejected request returns `429` with `Retry-After` and no audit event carrying request content.

### D4. Lockout is a D1 conditional update

`users` query module gains:

- `findLoginByEmail(db, email)` returning auth material plus `failed_login_count` and `locked_until`.
- `recordFailedLogin(db, userId, now, threshold, lockMs)` using one guarded `UPDATE`:

```sql
UPDATE users
SET failed_login_count = failed_login_count + 1,
    locked_until = CASE
      WHEN failed_login_count + 1 >= ? THEN ?
      ELSE locked_until
    END,
    updated_at = ?
WHERE id = ? AND status = 'active'
```

- `resetLoginFailures(db, userId, now)` clearing both columns.

The update is atomic in D1; concurrent failures increment the same row. An expired lock starts a fresh consecutive window at one failure instead of re-arming the old counter. The tenth failure sets the deadline; the next request observes 423.

### D5. Lockout behavior in the login use-case

Order of checks:

1. Load the login state by email.
2. If the email is unknown, verify against synthetic material and return generic 401.
3. If `locked_until > now`, return `423` with `Retry-After = ceil((locked_until - now) / 1000)`.
4. Verify `authHash`; on failure, increment the counter and return 401. If this failure reached ten, the next request returns 423.
5. On success, reset counters before challenge/session issuance.

Disabled accounts remain generic 401 and are not counted. Unknown emails never create lock state. This preserves the existing anti-enumeration behavior except for the explicitly required locked-account response.

### D6. Audit events remain payload-free

Failed attempts keep `login.failed` with peppered UA/IP hashes. A lock transition emits `login.locked` with the user id and timestamp. Rate-limit rejections are not audited because they carry no authenticated user and would create an attacker-controlled write amplifier.

## Risks / Trade-offs

- [Edge-local limiter is approximate] → D1 lockout remains authoritative; the limiter only sheds traffic.
- [423 reveals that an account exists] → required by the acceptance criteria; the response contains no email, role, or session data.
- [Shared IP budget can affect legitimate users] → IP budget is higher than identity budget; identity lock is per account.
- [Rate limiting in routes can be forgotten in future routes] → the helper is centralized and AGENTS/review should require it for new auth endpoints.
- [E2E logins can consume budgets] → E2E uses one account but stays below the identity budget; tests that must trigger 429 call the helper or use a fresh email key.
- [Recovery route is not covered] → `/auth/recover` is absent; the shared helper and requirement must be wired by the account-security change when the route lands.

## Migration Plan

1. Deploy the two rate-limit bindings and code.
2. No D1 migration; existing columns are used.
3. Rollback: revert the code and bindings; counters/locks are ordinary user columns and can remain.
