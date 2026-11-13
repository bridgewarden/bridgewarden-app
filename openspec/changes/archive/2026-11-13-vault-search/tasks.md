# Tasks

## 1. Search domain

- [x] 1.1 Add `vault-list.search.lib.ts` with field priorities, index builder, query matcher, snippet extraction, and highlight segments.
- [x] 1.2 Cap rendered results at 50 while returning the total match count.
- [x] 1.3 Add unit tests for name/username/URL/notes/body matching, case-insensitivity, empty query, trash exclusion, and highlight safety.
- [x] 1.4 Add a 1000-item benchmark asserting search stays under 50ms.

## 2. Palette UI

- [x] 2.1 Add `vault-search-dialog.tsx` with trigger, global `Ctrl/Cmd+K` listener, 50ms debounce, pending-result suppression, and dialog lifecycle.
- [x] 2.2 Add `vault-search-result.tsx` with semantic highlighted segments and active/selected option state.
- [x] 2.3 Integrate the trigger in the vault-list header and add all copy/shortcut hints to `app/lib/i18n/en.ts`.
- [x] 2.4 Implement ArrowUp/ArrowDown, Enter, Escape, focus restore, and `aria-activedescendant`.
- [x] 2.5 Add a polite live region for total matches and render-cap notice.

## 3. Privacy and resilience

- [x] 3.1 Ensure search never calls fetch or writes the query to URL/history/storage.
- [x] 3.2 Verify offline search against the cached unlocked projection.
- [x] 3.3 Add axe coverage for the palette with results and keyboard navigation.

## 4. E2E

- [x] 4.1 Add `e2e/vault-search.spec.ts` covering shortcut, trigger, each searchable field, highlight, keyboard selection, and focus restore.
- [x] 4.2 Assert no server request carries the query and no query appears in the URL/history.
- [x] 4.3 Cover offline search and opening a result.
- [x] 4.4 Add the Playwright project/order in `playwright.config.ts`.

## 5. Verification

- [x] 5.1 `pnpm typecheck`, `pnpm lint`, `pnpm format:check`
- [x] 5.2 `pnpm test` and `pnpm test:e2e --project=vault-search`
- [x] 5.3 `pnpm build` and budget report
- [x] 5.4 `openspec validate vault-search --strict`
