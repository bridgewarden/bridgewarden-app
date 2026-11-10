# Proposal

## Why

The `verify` job takes roughly eight minutes, and 72% of that time is the `playwright install --with-deps chromium` step (346s in run 42757787138). Test execution itself is fast: unit tests take 51s and E2E takes 53s. Contributors wait on package installation rather than on feedback about their change.

## What Changes

- Split the single `verify` job into parallel `quality` and `e2e` jobs.
- Run `quality` first-class on every pull request: typecheck, lint, format, unit tests, and build.
- Run E2E in a pinned Playwright container image that already contains Chromium and system dependencies, removing the `playwright install --with-deps` step from the critical path.
- Keep the same test commands, secrets preparation, and Playwright artifact upload behavior.
- Add workflow concurrency with `cancel-in-progress: true` so superseded pull-request runs stop consuming runners.
- Keep `push` to `main` covered.
- Out of scope: changing test coverage, test parallelism, Vitest isolation, or application behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is CI tooling only; no product behavior changes. The change sets `skip_specs: true`.

## Impact

- `.github/workflows/ci.yml` only.
- No application code, migrations, dependencies, or runtime behavior.
- CI must continue to run all existing quality and E2E checks and upload Playwright artifacts on failure.
- The Playwright image tag must stay aligned with `@playwright/test` in `package.json`.
