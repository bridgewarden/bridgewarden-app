# Design

## Context

See `proposal.md` and `specs/release-e2e/spec.md`. The suite is serial (`workers: 1`) with dependent projects and one local D1 state. Auth and vault projects disable trace/screenshot because those failures can contain cookies and typed plaintext. The folder API is implemented and unit-tested, but the UI only creates folders; rename and delete have no control.

## Goals / Non-Goals

**Goals:**
- Cover folder rename/delete through the real browser API and the real client ciphertext without adding product UI.
- Assert audit evidence once after the critical-flow projects complete.
- Make the artifact privacy exception explicit and testable through configuration.
- Report the Playwright runtime and warn when it exceeds 300 seconds.

**Non-Goals:**
- New folder management UI, API, migration, or dependency.
- Sharding, retries, or skipped critical-flow projects to meet the budget.
- Multi-worker execution against the shared local SQLite D1 state; four- and two-worker runs produced `SQLITE_BUSY_SNAPSHOT` and timeouts.
- Docs, runbook, or production deploy work (later changes).

## Decisions

### Folder lifecycle uses existing ciphertext

Create folders `A` and `B` through the item editor. Read both folder rows from `.wrangler/e2e` D1. PATCH `A` with `B`'s `nameCt`/`nameIv` and `A.rev`, then reload, unlock, and assert the folder filter shows the duplicated name. DELETE `B` with an originated authenticated request, reload, and assert it is gone while an item that referenced it remains in the list with no folder.

This exercises the rename/delete happy path, sync, and decryption using ciphertext the client produced. Stale-revision and cross-user conflicts remain covered by `app/routes/__test__/folders-routes.test.ts` because a second authenticated vault fixture is outside this change. It avoids duplicating crypto in Playwright and avoids adding a UI surface that no PRD requirement asks for. A folder-management UI would be a separate product change.

### Audit helper queries local D1

Add `e2e/audit.ts` with `readAuditEvents` and `expectAuditEvent(rows, type, { userId, metadata })`. A final `audit` project runs after `recover` and `vault-trash`, loads the audit table once, scopes rows to the acting user, and rejects sensitive or non-allowlisted metadata. This keeps evidence for every required flow without one `wrangler` process per assertion, which would push the suite over budget. Where multiple tests produce the same event type, assert presence for the actor; use exact counts only for flow-owned events.

### Authenticated failure artifacts stay off

`playwright.config.ts` keeps `trace: 'off'` and `screenshot: 'off'` for every project that authenticates or touches the vault. Unauthenticated smoke remains `retain-on-failure`. Document the exception in `e2e/README.md`: a trace can contain cookies, typed master passwords, item plaintext, and TOTP seeds, so the suite trades debuggability for the zero-knowledge boundary. Authenticated failures remain diagnosable through Playwright error context, D1 assertions, and server logs with redaction.

### Runtime measurement is informational

`scripts/test-e2e.ts` reads Playwright's JSON reporter `stats.duration` for test-execution time, prints wall time separately, and warns above `E2E_BUDGET_SECONDS` (default 300). The owner accepted a longer serial suite while per-worker D1 isolation is deferred; retries, skipped flows, and retry-based green runs remain prohibited.

## Risks / Trade-offs

- [Folder test depends on D1 ciphertext shape] -> Derive values from a UI-created folder, and assert through the public API and synced projection rather than internal modules.
- [Audit assertions become slow] -> Query D1 only after actions already present in the suite; no new browser flows.
- [Hard 300-second budget flakes on CI] -> Treat the budget as informational while per-worker D1 isolation is deferred; keep the serial suite and report both measured duration and wall time.
- [No trace for authenticated failures] -> Preserve redacted request logs, D1 assertions, and Playwright error context; document the accepted privacy trade-off.
