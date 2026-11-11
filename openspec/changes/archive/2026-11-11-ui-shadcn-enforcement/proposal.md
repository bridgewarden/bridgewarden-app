# Proposal

## Why

The UI mixes shadcn primitives with raw tables, native selects, and hand-built card/alert containers. This makes focus, radius, spacing, and invalid states drift between features. Shadcn now provides the missing structural primitives, so we can standardize them and enforce the boundary in lint.

Shadcn's Typography documentation is now implemented as Typeset, a CSS wrapper for prose content, not an installable React component. This change records that distinction instead of replacing semantic text with a non-existent primitive.

## What Changes

- Install shadcn `table`, `card`, `alert`, `separator`, and `native-select`.
- Replace the admin users raw table with shadcn Table components.
- Replace admin native selects with Native Select, preserving form semantics.
- Replace card-like `div/section` containers in feature UI with Card composition.
- Replace form-level warning/error blocks with Alert where the block is a page/section message.
- Use Separator for semantic dividers; keep row borders in Table.
- Use CardTitle, CardDescription, AlertTitle, and AlertDescription for text inside those compositions.
- Keep `<p>`, `<span>`, headings, and field-level validation messages semantic; shadcn does not provide Paragraph/Span components.
- Add ESLint restrictions for raw `<table>`, `<select>`, and `<input>` outside `app/components/ui`.
- Document that Typeset applies only to prose/markdown surfaces and is not installed globally while the app has no such surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-system`: add the structural primitive set, shadcn-only interactive controls, Typography policy, and enforcement.

## Impact

- `app/components/ui/` gains five generated components.
- Admin users, account settings, the app shell, and the locked overlay move card/alert/table markup to primitives; setup 2FA warnings become Alerts. Login, recovery, and member setup keep their existing field-level messages.
- `eslint.config.js` gains restricted-syntax rules for feature UI.
- Tests update selectors only where Native Select changes accessible structure.
- No server, API, database, crypto, or vault behavior changes.
