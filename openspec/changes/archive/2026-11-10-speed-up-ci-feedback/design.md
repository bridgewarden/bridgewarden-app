# Design

## Context

See `proposal.md` - Why. The current single `verify` job runs five fast quality checks before a 346-second `playwright install --with-deps chromium`, then a 53-second E2E suite. GitHub's `ubuntu-latest` image does not include Chromium, and `--with-deps` runs `apt-get update` and dependency installation on every run.

The project already pins `@playwright/test` in `package.json`; the current resolved version is `1.64.1`. The Playwright Docker image for that version is built on Ubuntu Noble with Node.js 24, which satisfies `.nvmrc` and `engines.node`.

## Goals / Non-Goals

**Goals:**

- Make quality feedback available in roughly the time the quality checks take, independent of browser installation.
- Remove browser and system-dependency installation from the E2E critical path.
- Preserve every existing check, E2E behavior, secret preparation, and failure artifact.
- Cancel superseded pull-request runs.

**Non-Goals:**

- Changing tests, coverage, Vitest sequencing, or application code.
- Parallelizing Playwright projects that currently share database state.
- Caching or deploying build artifacts.
- Self-hosted runners or paid larger runners.

## Decisions

### Split `quality` and `e2e` into parallel jobs

`quality` runs checkout, pnpm setup, install, typecheck, lint, format, unit tests, and build. `e2e` runs independently with the same checkout, pnpm setup, install, secrets, E2E, and artifact upload.

Parallel jobs duplicate roughly 14 seconds of setup but reduce wall-clock time and surface quality failures without waiting for browser setup. The alternative - `e2e` with `needs: quality` - saves runner minutes when quality fails but serializes the two slowest phases and loses the feedback benefit.

### Use the pinned Playwright container image for E2E

Run the `e2e` job inside `mcr.microsoft.com/playwright:v1.64.1-noble`. The image already contains Chromium, the headless shell, and all system dependencies, so the job no longer runs `playwright install --with-deps`.

Alternatives considered:

- **Cache `~/.cache/ms-playwright`**: browser download is cached, but the project still needs system libraries. Keeping `--with-deps` retains the expensive apt step; dropping it makes the job depend on undocumented runner image contents.
- **`playwright install --only-shell chromium`**: reduces download size but keeps apt as the dominant cost.
- **Cache machine image or self-hosted runner**: faster but adds infrastructure outside this repository.

The image tag must be updated together with `@playwright/test`. The version is recorded in a workflow comment and enforced by the pinned tag.

### Run both jobs on pull requests and `main`

The existing triggers stay: every `pull_request` and every push to `main`. Splitting jobs does not change which revisions are verified.

### Add workflow concurrency with cancellation

Use a group keyed by workflow and ref with `cancel-in-progress: true`. Superseded runs on the same pull request stop instead of consuming two runners. The latest commit always gets a full run.

### Keep failure artifacts and prepare secrets in the E2E job

Generate the same `.dev.vars` content as today, immediately before E2E. Upload `playwright-report/` and `test-results/` only when the job fails; successful runs no longer spend time uploading an empty or unneeded report. Failure artifacts remain available for seven days.

## Risks / Trade-offs

- **Container image pull is slower or throttled than expected** -> measure the first run; fall back to cached browsers plus a conditional dependency install only if the container approach is not faster in practice.
- **Image tag drifts from `@playwright/test`** -> pin both to the same version and update them in the same change; add a workflow comment naming the coupling.
- **Root user inside the container causes Chromium sandbox issues** -> run the container as the image's non-root user if the first run fails, or launch with the documented sandbox flags; do not disable the sandbox silently.
- **Both jobs install dependencies independently** -> pnpm's store cache keeps install near four seconds; the duplication is cheaper than serializing quality behind E2E.
- **E2E runs even when quality fails** -> accepted to preserve fast feedback; concurrency cancellation limits wasted work from superseded commits.
- **Container image includes Firefox and WebKit that the project does not use** -> larger pull than a Chromium-only cache, traded for deterministic system dependencies and no apt step.

## Migration Plan

1. Update `.github/workflows/ci.yml` in one change; no application deploy or data migration.
2. Open a pull request and compare the new job timings with run `42757787138`:
   - baseline: 8m 6s total, 346s Playwright install, 53s E2E.
   - target: quality under 2 minutes; E2E job under 3 minutes including image pull; wall clock under 3 minutes.
3. If the container job is not faster or fails on sandbox/user permissions, revert to a cached-browser variant in a follow-up rather than blocking application work.
4. Rollback is reverting `.github/workflows/ci.yml`; it has no runtime effect.

Measured result: run `42759706364` completed `quality` in 1m58s and `e2e` in 1m55s, both passing. The previous single job took 8m06s.

## Open Questions

None. The container image's Node.js version and the project's Node requirement were verified against the Playwright 1.64.1 Dockerfile.
