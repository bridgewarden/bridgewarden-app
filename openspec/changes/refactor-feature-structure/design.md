# Design

## Context

See `proposal.md` for motivation. The current UI layout mixes three concerns in each page file:

- `login.tsx` (434 lines) holds response types, three fetchers, five effects, vault-key lifecycle, and both forms.
- `setup.tsx` (573 lines) holds constants, pure helpers, reducer-driven flow effects, and four step forms.
- `account-settings.tsx` (272 lines) still holds the fetcher/step-up flow while four panel components sit flat beside it.

Existing constraints that shape the approach:

- Features never import another feature; shared UI moves to `app/components/`.
- Server code stays under `.server/` and is not affected by this UI convention.
- Route modules remain transport modules that render the feature page entry.
- kebab-case and existing naming rules remain in force.

## Goals / Non-Goals

**Goals:**

- Make every nontrivial page a composition layer with no response types, fetcher/effect flow, constants, or pure helpers.
- Give feature UI a predictable shape: `components/`, feature-suffixed files, and folder splits only when a file grows.
- Keep imports short through barrels without introducing cycles.
- Document the rule so future MVP features follow it from the start.
- Keep behavior, routes, API contracts, and tests unchanged.

**Non-Goals:**

- Refactoring server code, route modules, or `app/lib` helpers.
- Introducing a state-management library, React Query, or a new component abstraction.
- Splitting `vault-list` or `vault-trash` while they remain trivial pages.
- Moving 2FA UI into the `two-factor` feature, which would violate feature isolation.
- Changing visual design, copy, accessibility behavior, or test assertions.

## Decisions

### D1. Page files become composition only

`features/<feature>/<feature>.tsx` is a thin entry that renders the feature's public container. The container owns the feature hook and page layout, so the page does not call the hook. The page does not declare API response types, fetchers, effects, constants, or pure helpers.

Alternative considered: keep state in the page and only extract JSX. Rejected because the folio logic would still be untestable without rendering the page and the file would keep growing.

### D2. Feature components live under `components/` with a barrel

```text
features/<feature>/components/
├── index.ts
├── <component>.tsx
└── <component>.tsx
```

- The page imports the public container from `./components`.
- The barrel exports only the public container; leaf components remain internal.
- Files inside `components/` import concrete siblings, not the barrel, to avoid cycles.
- Tests may import concrete component files when they need one unit.
- Barrels never export the page or server code.

Alternative considered: flat components beside the page (`backup-codes-panel.tsx`). Rejected because the feature root becomes a mix of page, parts, hooks, and types with no visual boundary.

### D3. Feature-suffixed files stay flat until ten exported functions

Non-component code uses feature-suffixed files:

```text
<feature>.hooks.ts
<feature>.constants.ts
<feature>.lib.ts
<feature>.types.ts
<feature>.state.ts
```

A suffixed file may stay flat while it exports at most ten functions/hooks. Exported types, constants, and internal helpers do not count toward the threshold. Above ten, or when the file exceeds the line guard, split by concern into `hooks/` or `lib/`, add a barrel for that folder, and keep each file below the threshold.

A soft 200-line guard applies independently: a file over roughly 200 lines must be split by concern even if it exports one function. This catches a single oversized hook that the function count would miss.

Alternative considered: split into folders immediately. Rejected because small features would get extra directories and barrels before they need them.

### D4. State remains pure and separately testable

`setup.state.ts` keeps the reducer, initial state, and pure transitions. `setup.hooks.ts` owns React effects and submission orchestration. This keeps reducer tests free of React rendering and prevents the hook from becoming a second page file.

The same split applies later if another feature's state logic grows beyond a small reducer.

### D5. Feature-local UI stays with its host page

`two-factor` remains server-only. The login challenge UI stays under `features/login/components/`; enrollment and backup-code UI stay under `features/account-settings/components/`. Moving them into `features/two-factor/components/` would force `account-settings` or `login` to import another feature, violating the existing isolation rule.

Alternative considered: move shared 2FA UI to `app/components/`. Rejected because the panels are not shared; each is page-specific and uses host-page callbacks.

### D6. Keep domain-named modules when the name is the context

`setup-keys.ts` remains as a domain module because it is cryptographic setup material, not a generic helper bucket. If it grows past the threshold, it may become `setup.lib.ts` or a `lib/` split, but the rename happens then, not preemptively.

### D7. Refactor in behavior-preserving slices

Each feature is refactored in its own commit, with the full gate after the last slice. Imports and test paths update in the same commit as the moved files. The page entry and route contract remain unchanged.

## Risks / Trade-offs

- [Barrel cycle] → Files inside a component directory import concrete siblings; only external consumers use `index.ts`.
- [Over-splitting] → Keep flat suffixed files until ten exports or roughly 200 lines; do not create empty folders.
- [Import churn hides regressions] → Move files without changing logic, keep tests and E2E assertions intact, and run the full gate.
- [A barrel pulls unused components into a chunk] → Barrels only export page-owned components; no server modules and no route-level code.
- [The rule is ignored by future features] → Add the rule to `AGENTS.md` and reference it from the project structure section.
- [2FA UI ownership confusion] → Document that server-only features may have no UI and that host pages own their page-specific UI.
