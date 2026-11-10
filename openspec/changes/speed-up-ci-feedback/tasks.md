# Tasks

## 1. Split quality checks into their own job

- [x] 1.1 Create a `quality` job in `.github/workflows/ci.yml` that runs checkout, pnpm setup, Node setup with pnpm cache, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build`; verify the workflow contains all five checks and `pnpm exec prettier --check .github/workflows/ci.yml` passes.
- [x] 1.2 Add `permissions: contents: read`, a job timeout, and workflow-level concurrency keyed by workflow and ref with `cancel-in-progress: true`; verify a superseded pull-request run is reported as cancelled in GitHub Actions.

## 2. Move E2E to the pinned Playwright container

- [x] 2.1 Create an `e2e` job with `container.image: mcr.microsoft.com/playwright:v1.64.1-noble`, keeping pnpm setup, Node setup, and `pnpm install --frozen-lockfile`; verify the image tag matches `pnpm exec playwright --version` and add a comment naming that coupling.
- [x] 2.2 Keep the existing `.dev.vars` generation in the `e2e` job and remove `pnpm exec playwright install --with-deps chromium`; verify no install step remains and secrets are still written immediately before `pnpm test:e2e`.
- [x] 2.3 Change Playwright artifact upload to run only on job failure, retaining `playwright-report/` and `test-results/` for seven days; verify the workflow condition is `failure()` and the paths are unchanged.

## 3. Verify behavior and measure the improvement

- [x] 3.1 Open a pull request and confirm both `quality` and `e2e` jobs pass on the same commit; verify the PR checks list shows two independent jobs.
- [x] 3.2 Record per-job and total wall-clock timings in the pull request and compare them with run `42757787138` (8m 6s total, 346s Playwright install); verify quality finishes under 2 minutes and the E2E job under 3 minutes including image pull.
- [x] 3.3 Confirm failure artifacts are uploaded by inspecting a deliberately failing E2E run or the workflow dry-run output, then remove the temporary failure; verify the report artifact exists only for the failed attempt.
- [x] 3.4 If the container job is slower than the baseline or fails on sandbox/user permissions, document the measured result and revert to the cached-browser fallback from `design.md` rather than disabling browser sandboxing.

## Workflow follow-up

- Archive the change after the CI timings are confirmed on a real pull request.
- Apply the same job split to any future required workflow, if one is introduced.
