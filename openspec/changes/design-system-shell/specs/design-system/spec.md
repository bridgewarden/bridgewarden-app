# Spec Delta

## Purpose

Defines the shared visual language - semantic color roles, typography, radii, focus treatment,
and the reusable UI primitives - so every screen looks and behaves consistently and meets the
accessibility baseline without restyling components individually.

## ADDED Requirements

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

The system SHALL provide the MVP primitive set (button, input, label, textarea, select, checkbox,
dialog, alert-dialog, dropdown menu, toast, tooltip, sheet, skeleton, badge, switch, tabs) with
consistent radius, focus ring, disabled, and invalid states.

#### Scenario: Focus visibility

- **WHEN** a keyboard user focuses a button or input
- **THEN** a visible focus ring using the ring token appears and is not removed by any component

#### Scenario: Invalid input state

- **WHEN** a form control is marked invalid
- **THEN** it uses the destructive token for its border and exposes the invalid state to assistive technology

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
