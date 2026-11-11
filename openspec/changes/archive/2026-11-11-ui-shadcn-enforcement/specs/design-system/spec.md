# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
