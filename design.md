# Design — Bridgewarden

A locked design system for the product UI. Page work reads this file before changing structure or tokens. The interactive reference is `docs/ux-redesign-poc.html`.

## Genre

`modern-minimal` with a technical-utility overlay: calm, precise, high-contrast, and instrument-like. Not decorative, not a generic SaaS dashboard, and not a monospace theme applied to every surface.

## Macrostructure family

- App pages: Workbench. A compact header, one content frame, ruled panels, and dense but readable rows.
- Auth and onboarding: focused gate. A narrow task column with one primary action and no authenticated action cluster.
- Marketing/content pages: not part of this app yet.

## Theme — Signal

Semantic tokens live in `app/app.css` and use `light-dark()`.

- Paper: `oklch(0.982 0.004 250)` light / `oklch(0.17 0.012 250)` dark.
- Ink: `oklch(0.205 0.018 250)` light / `oklch(0.955 0.006 250)` dark.
- Accent: `oklch(0.47 0.15 250)` light / `oklch(0.68 0.14 250)` dark.
- Focus: `oklch(0.62 0.16 250)` light / `oklch(0.74 0.14 250)` dark.
- Destructive remains a separate red role and is reserved for irreversible or access-changing actions.

Primary is the only chromatic flood and must stay under roughly 5% of a viewport. Use the semantic shadcn roles, never raw colors in feature components.

## Typography

- Display and body: the system sans stack (`ui-sans-serif`, system UI, Segoe UI, Roboto).
- Metadata, counts, keyboard hints, IDs, and short technical labels: the system monospace stack.
- Headings are roman, tight-tracked, and never italic. Body text is normal weight; hierarchy comes from size, weight, and rules.
- No third-party fonts, font requests, or analytics.

## Spacing and shape

- Use the existing Tailwind 4/8-point spacing scale; do not introduce a parallel spacing system.
- Control radius: 6px (`--radius-md`). Surface radius: 8px (`--radius-lg`/`--radius-xl`).
- Borders are 1px rules; avoid stacked shadows and glass effects.
- Interactive targets are at least 44px on touch and at least 3:1 against their background.
- Focus is a visible 2–3px ring using `--ring`; it must appear instantly and never be animated.

## Motion

Motion-cut by default. Use only opacity and transform, 150–220ms, with the shared easing tokens. Reduced motion collapses spatial movement to an opacity change. No scroll reveals, bounce, or celebratory motion.

## Microinteractions

- Silent success for ordinary saves; reserve toasts for asynchronous or destructive outcomes.
- Copy actions confirm without moving focus.
- Destructive actions require an explicit confirmation and name the target.
- Use 800ms hover tooltips and immediate focus tooltips.
- Do not block the whole surface with a loading state when a local skeleton is enough.

## CTA voice

- Primary: solid accent, 6px radius, sentence case, one clear verb.
- Secondary: outline or ghost, 6px radius, no competing accent.
- Labels describe the result (“Save item”, “Create setup link”), not the mechanism.
- No invented metrics, testimonials, or security claims.

## Per-page allowances

- App pages: no decorative enrichment; function carries the page. Tables and panels may vary density.
- Auth/onboarding: one task column; illustration only if it explains the task.
- Settings and admin: section index and grouped panels may differ, but heading rhythm and control geometry stay shared.

## What pages MUST share

- Wordmark, shield mark, and theme control placement.
- Signal palette, system fonts, focus ring, radii, and rule language.
- Page-header rhythm: mono context label, one h1, short supporting line, action cluster.
- Destructive-action voice and confirmation pattern.
- Touch-target, keyboard, error, and live-region behavior.

## What pages MAY differ

- Panel composition and density (list, editor, admin table, onboarding).
- Whether a section uses an index, a tab strip, or stacked groups.
- Auth/onboarding width versus app width.

## Exports

The implementation source is `app/app.css`; it maps the semantic roles into Tailwind/shadcn tokens. Do not create a second `tokens.css` or restyle generated primitives individually when a token/variant change is sufficient. When a shared primitive has a contrast or focus defect, fix the shared class once.
