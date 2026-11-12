# Spec Delta

## Purpose

Defines responsive behavior, mobile navigation, and touch-target requirements for the authenticated vault surfaces from 360px upward.

## ADDED Requirements

### Requirement: Responsive vault surfaces

The login, vault list, editor, trash, generator, and settings surfaces SHALL remain usable at 360px, 768px, and 1024px+ without horizontal scrolling. Primary actions MUST remain visible and secondary metadata MAY be hidden at narrow widths.

#### Scenario: 360px list
- **WHEN** the vault list renders at 360px
- **THEN** rows and controls fit without horizontal overflow

#### Scenario: 768px surfaces
- **WHEN** vault surfaces render at 768px
- **THEN** primary content remains readable and actions remain reachable

#### Scenario: Desktop
- **WHEN** surfaces render at 1024px or wider
- **THEN** content uses the available width without stretched controls

### Requirement: Compact header

The authenticated header SHALL collapse secondary actions into a compact menu or icon controls below the desktop breakpoint while preserving lock, theme, settings, trash, and sign-out access.

#### Scenario: Narrow header
- **WHEN** the header renders at 360px
- **THEN** all account actions remain reachable without horizontal scrolling

#### Scenario: Desktop header
- **WHEN** the header renders at 1024px
- **THEN** primary navigation remains directly visible

### Requirement: Touch targets

Interactive controls on touch-capable layouts SHALL expose a target of at least 44px while preserving visible focus treatment.

#### Scenario: Mobile action
- **WHEN** a button or row is rendered at 360px
- **THEN** its interactive target is at least 44px

### Requirement: Mobile editor

The item editor SHALL become a full-screen surface below the mobile breakpoint. It MUST keep its header/actions reachable and MUST NOT use a fixed height that breaks the on-screen keyboard.

#### Scenario: Open editor on mobile
- **WHEN** an item editor opens at 360px
- **THEN** it occupies the viewport and exposes save/back actions

#### Scenario: Keyboard visible
- **WHEN** a mobile text field has focus
- **THEN** the editor scrolls without clipping the active field

### Requirement: Viewport verification

Playwright SHALL cover login, vault list, editor, trash, and generator at 360px and 768px; every checked page MUST satisfy `scrollWidth <= clientWidth` and provide required actions. Authenticated surfaces MUST NOT write screenshot artifacts containing vault plaintext.

#### Scenario: Viewport matrix
- **WHEN** the viewport test matrix runs
- **THEN** every surface passes the overflow and action assertions at both widths

#### Scenario: No plaintext artifacts
- **WHEN** the viewport suite completes
- **THEN** no full-page screenshot containing authenticated vault content is written
