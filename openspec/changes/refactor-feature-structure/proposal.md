# Proposal

## Why

Feature page files have become mixed-responsibility modules: `setup.tsx` is 573 lines, `login.tsx` is 434 lines, and `account-settings.tsx` still owns all fetcher and state logic while its panels sit flat beside it. The lack of a structural rule makes review, testing, and future feature work harder without improving behavior. This is the right time to establish the convention before the next MVP feature adds more UI.

## What Changes

- Define one feature UI structure: a page entry that only composes, feature-owned components under `components/`, and non-component code in feature-suffixed files.
- Allow `components/index.ts` barrels so page imports stay short; consumers outside a directory import through the barrel, while files inside import concrete siblings to avoid cycles.
- Keep `hooks`, `lib`, `constants`, `types`, and `state` in `<feature>.<suffix>.ts` while a file exports at most ten functions/hooks.
- When a suffixed file exceeds ten exported functions/hooks, split it by concern into `hooks/` or `lib/` with a barrel. A file over roughly 200 lines must also be split by concern, even if it has one export.
- Refactor the existing nontrivial features to follow the rule:
  - `login`: credentials form and 2FA challenge as components, flow logic in a hook, response types separated.
  - `setup`: account, password, recovery, and 2FA steps as components; reducer, constants, types, and pure helpers separated.
  - `account-settings`: 2FA card and its panels nested under `components/`, settings flow in a hook, response types separated.
- Leave `vault-list` and `vault-trash` unchanged until they grow beyond a trivial page.
- Document the rule in `AGENTS.md`.

## Capabilities

### New Capabilities

None. This is a structural refactor with no externally observable behavior change.

### Modified Capabilities

None. Existing specs continue to describe the same behavior.

## Impact

- UI organization under `app/features/{login,setup,account-settings}` and their tests.
- Import paths and component boundaries only; no route contract, loader/action shape, API, database, crypto, or security behavior changes.
- `AGENTS.md` gains a "Feature UI structure" section and updated naming guidance.
- Full unit, E2E, typecheck, lint, format, build, and OpenSpec validation must remain green.
