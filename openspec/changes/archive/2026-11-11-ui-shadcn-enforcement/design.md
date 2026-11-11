# Design

## Context

See `proposal.md` - Why. `components.json` already points shadcn at `app/components/ui`, `~/components`, and `~/lib/class-names`. The repo has the core primitives but no Table, Card, Alert, Separator, or Native Select. Admin users is the only feature with a raw table and native selects; card-like containers and form-level messages are repeated across account settings, setup, login, recovery, member setup, and the shell.

Shadcn Typography is implemented as Typeset: a generated CSS file and a `.typeset` wrapper for prose/markdown. It is not distributed as a registry component; `shadcn view typography` has no item.

## Goals / Non-Goals

**Goals:**

- Install and use the missing structural primitives.
- Keep native form semantics while adopting shadcn styling.
- Replace repeated card and alert containers.
- Make the primitive boundary enforceable in lint.
- Record where Typeset does and does not apply.

**Non-Goals:**

- Replacing semantic `<p>`, `<span>`, or headings with wrappers.
- Applying Typeset globally to app chrome.
- A design-token overhaul or visual redesign.
- New server, API, database, crypto, or vault behavior.
- A Data Table abstraction with sorting/filtering; the admin list stays a plain Table.

## Decisions

### Install the official registry items

```bash
pnpm dlx shadcn@latest add table card alert separator native-select
```

These generate source into `app/components/ui/`. The CLI rewrites imports to the configured `~/lib/class-names` alias. No new runtime dependency is expected beyond the existing `radix-ui`, `class-variance-authority`, and `lucide-react` set; verify the diff before committing.

### Table replaces only the admin users table

Use:

```text
Table
TableHeader / TableBody
TableRow / TableHead / TableCell
```

Keep the horizontal overflow provided by Table. Override `whitespace-normal` on the identity cell so long emails wrap. Do not introduce a generic Data Table until a second table exists.

### Native Select for form-submitted roles

Admin invitation and per-row role controls submit through native forms and rely on `FormData` and `selectOption` behavior. Use:

```text
NativeSelect
NativeSelectOption
```

The generated wrapper is `w-fit`; wrap it in a full-width container with utility classes rather than editing the primitive's visual classes. Preserve the existing accessible labels and disabled rules.

### Card composition for repeated sections

Map each bordered `div/section ... p-5` that represents a titled section to:

```text
Card
  CardHeader
    CardTitle
    CardDescription
  CardContent
```

Use CardFooter only when an action row is truly separate from content. Do not convert layout-only blocks, warning banners, or nested muted panels into Cards. Keep heading semantics: CardTitle is a visual title; use a real `h2` when the section needs document outline structure, or add `role="heading" aria-level={2}` if the primitive renders a div and the outline matters.

### Alert for form-level messages

Use Alert for:

- admin invitations/setup-link warning and mutation error;
- shell two-factor warning;
- section-level success/failure that is not attached to one input.

Use `AlertDescription`, plus `AlertTitle` when the message has a distinct title beyond the nearby section heading. Preserve `role="status"` for non-error warnings by overriding the default `role="alert"`. Field-level validation errors stay as `<p id role="alert">` and keep `aria-describedby`.

### Separator only for semantic dividers

Use Separator where a horizontal rule communicates grouping. Do not replace Table row borders or every decorative `border-b`; those belong to the owning primitive.

### Typography and text

- Card titles/descriptions use CardTitle/CardDescription.
- Alert titles/descriptions use AlertTitle/AlertDescription.
- Standalone paragraphs, inline spans, headings, code blocks, and field errors stay semantic HTML with token utilities.
- No `Paragraph` or `Span` component is created under `components/ui`.
- Typeset CSS is added only when a real prose/markdown surface exists; that future change wraps that surface in `.typeset`, not the app shell.

### Lint enforcement

Add `no-restricted-syntax` in the flat ESLint config for `app/**/*.tsx`, excluding `app/components/ui/**`:

```text
JSXOpeningElement[name.name='table']
JSXOpeningElement[name.name='select']
JSXOpeningElement[name.name='option']
JSXOpeningElement[name.name='input']
```

Messages point to the shadcn primitive. Do not restrict `p`, `span`, `ul`, `li`, or layout elements. Raw hidden/file inputs are the only allowed exception and require an inline disable with justification. Generated primitives remain exempt because the rule scope excludes `app/components/ui`.

## Risks / Trade-offs

- **Card spacing changes** -> Card uses `px-6 py-6`, not `p-5`; use explicit utility wrappers only where layout requires it, not token overrides.
- **Alert announces on mount** -> static warnings must set `role="status"`; destructive errors keep `role="alert"`.
- **Native Select width** -> generated wrapper is `w-fit`; use a full-width wrapper utility rather than editing the primitive.
- **Table nowrap** -> override wrapping per identity cell where long emails would overflow.
- **Lint false positives** -> restrict only raw structural/form tags and exclude generated UI.
- **Typeset confusion** -> the spec names it as prose CSS so future work does not hunt for a non-existent component.

## Migration Plan

1. Install registry items and verify imports/dependencies.
2. Refactor admin users first to prove Table, Native Select, Card, Alert.
3. Refactor account settings and auth/setup cards and form-level alerts.
4. Add lint restrictions and fix remaining violations.
5. Run typecheck, lint, unit, build, and E2E; visually inspect affected routes.
6. Roll back by reverting the refactor commit; generated primitives are additive.

## Open Questions

None.
