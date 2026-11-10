# Proposal

## Why

The merged `change-master-password` artifact marks tasks 5.1, 5.2, and 5.4 as complete. Some coverage exists, but the suite lacks disabled-account behavior, wrong-current-proof rejection with a real session, route success with a working reissued cookie, lockout rejection, and proof that rotation leaves recovery columns untouched. These are security-sensitive transitions and should not rely on E2E coverage alone.

## What Changes

- Add use-case tests for password rotation on a disabled account, a missing account, and a stale credential snapshot.
- Add route tests with a real session for wrong current proof and successful rotation, including `Set-Cookie`, `Cache-Control`, and absence of secret fields in the response.
- Add a crypto test proving the existing recovery key still unwraps the same vault key after a password rotation.
- Keep the existing E2E rotation and second-session revocation coverage.
- No production behavior or API changes. If a new test exposes a defect, pause and capture the fix separately rather than weakening the test.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change adds missing tests only; no requirement text changes. The change sets `skip_specs: true`.

## Impact

- Test files under `app/features/account-settings/__test__/`, `app/routes/__test__/`, and `app/lib/crypto/__test__/`.
- No application code, migration, dependency, or runtime behavior change.
- `openspec/changes/change-master-password/tasks.md` checkboxes become truthful once the tests exist.
