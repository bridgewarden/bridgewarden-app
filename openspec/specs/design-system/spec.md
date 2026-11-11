# design-system Specification

## Purpose
Defines the shared visual language - semantic color roles, typography, radii, focus treatment,
and the reusable UI primitives - so every screen looks and behaves consistently and meets the
accessibility baseline without restyling components individually.

## Requirements

### Requirement: Semantic color tokens

The system SHALL expose semantic color tokens (background, foreground, muted, muted-foreground,
primary, primary-foreground, destructive, border, input, ring) for both light and dark themes,
and components SHALL reference tokens rather than raw color values.

#### Scenario: Light theme default

- **WHEN** the document root has no `dark` class
- **THEN** the page renders the light token values for background and foreground

#### Scenario: Dark theme override

- **WHEN** the document root has the `dark` class
- **THEN** the page renders the dark token values for the same semantic roles

### Requirement: Self-hosted typography

The system SHALL render text with a system font stack and MUST NOT request third-party fonts,
scripts, or analytics at runtime.

#### Scenario: No third-party font request

- **WHEN** any page loads
- **THEN** no network request is made to a third-party font or analytics host, and the computed font family starts with a system font

### Requirement: Shared UI primitives

The system SHALL provide the MVP primitive set (alert, alert-dialog, badge, button, card, checkbox, dialog, dropdown menu, input, label, native-select, select, separator, sheet, skeleton, switch, table, tabs, textarea, toast, tooltip) with consistent radius, focus ring, disabled, and invalid states.

#### Scenario: Focus visibility
- **WHEN** a keyboard user focuses a button or input
- **THEN** a visible focus ring using the ring token appears and is not removed by any component

#### Scenario: Invalid input state
- **WHEN** a form control is marked invalid
- **THEN** it uses the destructive token for its border and exposes the invalid state to assistive technology

#### Scenario: Structural consistency
- **WHEN** two features render a table, card, alert, or separator
- **THEN** both use the same shadcn primitive and token-based spacing

### Requirement: Token-only customization

The system SHALL require visual changes to be made through tokens in the single stylesheet
entry, and generated primitives MUST NOT be restyled individually.

#### Scenario: Brand color change

- **WHEN** the primary token changes in the stylesheet entry
- **THEN** every primitive using the primary role reflects the change without edits to individual component files

### Requirement: Accessible primitive behavior

Dialog and sheet primitives SHALL trap focus while open and restore focus to the trigger on
close, and toast notifications SHALL be announced through a live region.

#### Scenario: Dialog focus restore

- **WHEN** a dialog closes after the user activates its close control
- **THEN** focus returns to the element that opened the dialog

#### Scenario: Toast announcement

- **WHEN** a toast is shown after a save action
- **THEN** assistive technology receives the message through a live region without moving focus

### Requirement: Structural shadcn primitives

Feature UI SHALL use shadcn Table, Card, Alert, and Separator instead of hand-built structural markup for those roles. Card and Alert text SHALL use their description subcomponents, and SHALL use a title subcomponent when the message has a distinct title.

#### Scenario: Admin table
- **WHEN** the admin users list renders
- **THEN** it uses TableHeader, TableRow, TableHead, TableBody, and TableCell

#### Scenario: Section container
- **WHEN** a feature renders a bordered content section with a title and description
- **THEN** it uses Card and CardTitle/CardDescription instead of a styled container

#### Scenario: Form-level message
- **WHEN** a form or section exposes a warning or blocking error
- **THEN** it uses Alert and AlertTitle/AlertDescription

#### Scenario: Field validation
- **WHEN** a single field has a validation message
- **THEN** the message remains a semantic `<p>` with the appropriate alert relationship

### Requirement: Native Select boundary

Role and option controls that submit through native forms SHALL use the shadcn Native Select. Raw `<select>` and `<option>` elements MUST NOT appear outside `app/components/ui/`.

#### Scenario: Admin role control
- **WHEN** an administrator changes a role in the users table
- **THEN** the control uses Native Select while remaining keyboard and form compatible

#### Scenario: Raw select detection
- **WHEN** a feature module renders a raw `<select>` or `<option>`
- **THEN** lint fails that file

### Requirement: Typography policy

Shadcn Typography SHALL be treated as Typeset prose styling, not as installable Paragraph or Span primitives. Typeset MUST NOT be applied globally while no prose or markdown surface exists. Semantic `<p>`, `<span>`, and heading elements remain valid outside Card and Alert compositions.

#### Scenario: Prose surface appears
- **WHEN** a future feature renders markdown or long-form prose
- **THEN** it wraps that content in a scoped Typeset container rather than global element selectors

#### Scenario: Inline text
- **WHEN** a feature renders inline status or supporting text that is not a Card or Alert title/description
- **THEN** it uses a semantic element with token utilities

### Requirement: Raw control enforcement

ESLint SHALL reject raw `<table>`, `<select>`, `<option>`, and `<input>` elements in feature and component source outside `app/components/ui/`.

#### Scenario: Raw table
- **WHEN** a feature uses a raw `<table>` instead of Table
- **THEN** lint fails with the shadcn guidance message

#### Scenario: Primitive implementation
- **WHEN** a generated shadcn primitive uses its underlying HTML element
- **THEN** the restriction does not apply inside `app/components/ui/`
