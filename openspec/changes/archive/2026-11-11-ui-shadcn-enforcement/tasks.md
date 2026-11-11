# Tasks

## 1. Install primitives

- [x] 1.1 Run `pnpm dlx shadcn@latest add table card alert separator native-select`; verify generated files land in `app/components/ui/` and imports use `~/lib/class-names`.
- [x] 1.2 Inspect dependency/output changes; confirm no duplicate utility package or unrelated generated rewrite.
- [x] 1.3 Run `pnpm typecheck` and `pnpm build` after installation.

## 2. Admin users

- [x] 2.1 Replace the raw users table with Table, TableHeader, TableBody, TableRow, TableHead, and TableCell; preserve row actions and badges.
- [x] 2.2 Replace both native role selects with NativeSelect/NativeSelectOption; preserve labels, disabled rules, FormData, and mutation behavior.
- [x] 2.3 Replace invitation form and users containers with Card/CardHeader/CardTitle/CardDescription/CardContent.
- [x] 2.4 Replace the setup-link warning and mutation error with Alert/AlertTitle/AlertDescription; keep the warning as `role="status"`.
- [x] 2.5 Replace the pending invitation list container with Card; use Item only if it preserves semantics without extra abstraction.
- [x] 2.6 Verify long identity text wraps and the table remains horizontally usable at 360px.

## 3. Account settings and shell

- [x] 3.1 Convert Password, Auto-lock, Two-factor, and Backup-codes sections to Card composition.
- [x] 3.2 Convert section-level success/error messages to Alert where they are not field-level validation errors.
- [x] 3.3 Keep field errors as `<p role="alert">` with their existing ids and `aria-describedby`.
- [x] 3.4 Convert the shell two-factor banner to Alert with `role="status"` and Card/Alert text subcomponents where applicable.
- [x] 3.5 Add Separator only where a divider communicates grouping; leave Table row borders alone.

## 4. Auth, setup, and recovery

- [x] 4.1 Audit login, setup, recover, and member setup; they have no card-like containers, so no Card conversion is needed.
- [x] 4.2 Convert setup and shell form-level warnings to Alert; leave field-level login/recovery/member errors semantic.
- [x] 4.3 Preserve focus behavior, labels, described-by relationships, and live-region semantics.

## 5. Enforcement

- [x] 5.1 Add `no-restricted-syntax` rules for raw `table`, `select`, `option`, and `input` outside `app/components/ui/**`.
- [x] 5.2 Verify generated primitives are exempt and feature violations fail with guidance messages.
- [x] 5.3 Do not restrict `p`, `span`, headings, lists, or layout elements.

## 6. Typography decision

- [x] 6.1 Record in the design-system spec that shadcn Typography is Typeset prose CSS, not an installable Paragraph/Span component.
- [x] 6.2 Do not add global Typeset CSS; leave prose integration to the future surface that needs it.

## 7. Verification

- [x] 7.1 Update E2E selectors if Native Select or Table markup changes accessible structure; keep assertions behavior-based.
- [x] 7.2 Verify admin invite, role change, disable/revoke, account settings, setup, login, recovery, and locked overlay flows.
- [x] 7.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`; verify all pass.
- [x] 7.4 Run `pnpm exec openspec validate ui-shadcn-enforcement --strict`.

## Workflow follow-up

- Run `/preflight` before opening the PR.
- Archive the change after merge.
