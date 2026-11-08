# Tasks

## 1. Document the feature UI convention

- [x] 1.1 Add a "Feature UI structure" section to `AGENTS.md` covering page composition, `components/` with barrels, feature-suffixed files, the ten-export threshold, the 200-line guard, and barrel cycle rules; verify the section is present and consistent with "Project structure" and "File naming".
- [x] 1.2 Update the project structure tree in `AGENTS.md` to show `features/<feature>/components/` and feature-suffixed files; verify no existing rule contradicts the new convention.

## 2. Refactor the login feature

- [x] 2.1 Extract `PreloginResponse`, `LoginSuccess`, `LoginChallenge`, `LoginFailure`, and challenge response types into `app/features/login/login.types.ts`; verify typecheck passes with no behavior change.
- [x] 2.2 Move the flow state, fetchers, effects, and handlers from `login.tsx` into `app/features/login/login.hooks.ts` as one exported hook; verify the login unit tests still pass.
- [x] 2.3 Extract the credentials form and two-factor challenge form into `app/features/login/components/login-credentials-form.tsx` and `login-two-factor-form.tsx`, add `components/index.ts`, and keep accessibility attributes unchanged; verify the login page renders both states in E2E.
- [x] 2.4 Reduce `login.tsx` to composition around the hook and components; verify `app/features/login/__test__/*` and the auth E2E project pass.

## 3. Refactor the setup feature

- [x] 3.1 Split `setup-state.ts` into `setup.types.ts`, `setup.constants.ts`, `setup.state.ts` (reducer and initial state), and `setup.lib.ts` (pure helpers); verify all setup unit tests pass after import updates.
- [x] 3.2 Move the reducer/effect/submission orchestration into `app/features/setup/setup.hooks.ts`; verify the setup flow unit tests remain green.
- [x] 3.3 Extract account, password, recovery, and two-factor steps into `app/features/setup/components/setup-account-step.tsx`, `setup-password-step.tsx`, `setup-recovery-step.tsx`, and `setup-two-factor-step.tsx`, add `components/index.ts`, and preserve every accessible name and focus behavior; verify the setup E2E test passes.
- [x] 3.4 Reduce `setup.tsx` to composition around the hook and step components; verify no constants, response types, or pure helpers remain in the page file.

## 4. Refactor the account-settings feature

- [x] 4.1 Move `enrollment-panel.tsx`, `enabled-actions.tsx`, and `backup-codes-panel.tsx` under `app/features/account-settings/components/`, extract a `two-factor-card.tsx`, and add `components/index.ts`; verify imports resolve and the settings page renders.
- [x] 4.2 Move response types into `app/features/account-settings/account-settings.types.ts` and the fetcher/step-up flow into `account-settings.hooks.ts`; verify the 2FA unit tests still pass.
- [x] 4.3 Reduce `account-settings.tsx` to page composition around the hook and `TwoFactorCard`; verify the two-factor E2E project passes with the banner, enrollment, backup codes, and disable flow unchanged.

## 5. Integration verification

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`; verify all pass with the existing 168 unit and 16 E2E tests.
- [x] 5.2 Confirm no feature page imports another feature and no component imports a page; verify via targeted `rg` searches and review of the changed import graph.

## Workflow follow-up

- Run `/preflight` before opening the refactor PR.
- Archive the change after the PR is merged and verified.
