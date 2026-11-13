# End-to-end tests

The Playwright suite runs against local Cloudflare state only. It never uses the development
database, Internet access, or production credentials.

## Runtime and state

`pnpm test:e2e` applies migrations to `.wrangler/e2e`, starts a React Router dev server on
`http://localhost:8787`, starts a production preview on `http://localhost:8788`, and runs one serial worker. The local D1
state is a single SQLite file; multiple workers produce `SQLITE_BUSY_SNAPSHOT`, so concurrency
requires a per-worker database and is out of scope. The global setup resets users, audit events, and sessions; tests create their own
items, folders, and accounts with unique names.

Useful commands:

```bash
pnpm test:e2e
pnpm test:e2e --project=vault-folders
pnpm exec playwright install chromium
```

`E2E_BUDGET_SECONDS` defaults to `300`. The script prints the Playwright JSON reporter duration
and the wall clock; both cover the Playwright run, including configured web servers. The budget is
informational: a slower run still passes. Per-worker D1 isolation and the hard runtime target are
deferred. Partial `--project`/`--grep`/file-filter runs report duration but skip the budget.

## Failure artifacts

Traces and screenshots are off globally. Only the unauthenticated `smoke` project opts into
failure artifacts. CI uploads only `test-results/smoke` on failure. Authenticated reports and `test-results` are
never uploaded, because Playwright also writes text page snapshots there and those can contain
typed plaintext.

A trace or page snapshot can contain cookies, typed master passwords, decrypted item fields,
TOTP secrets, backup codes, and recovery material. Local failure artifacts are gitignored and
must not be shared. Authenticated failures are diagnosed through D1 assertions, deterministic
test assertions, and the redacted server request logs. Never point `--persist-to` at a
non-synthetic database: the fixture credentials and recovery key are public test data.
