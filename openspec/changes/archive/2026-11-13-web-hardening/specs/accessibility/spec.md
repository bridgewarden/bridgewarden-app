# Spec Delta

## Purpose

Defines WCAG 2.1 AA behavior and automated accessibility verification for the core authentication and vault surfaces.

## ADDED Requirements

### Requirement: Automated accessibility gate

The core surfaces SHALL pass an axe-core scan with zero critical or serious violations. The gate SHALL cover setup, login, 2FA, unlock, list, editor, and generator.

#### Scenario: Axe scan
- **WHEN** the accessibility suite runs against a core surface
- **THEN** no critical or serious axe violation is reported

#### Scenario: Regression failure
- **WHEN** a change introduces a critical or serious violation
- **THEN** the accessibility gate fails

### Requirement: Keyboard and focus behavior

All core flows SHALL be operable with a keyboard alone. Dialogs and sheets SHALL trap focus while open, restore focus to the trigger on close, and MUST NOT leave focus on an unmounted control.

#### Scenario: Keyboard critical flow
- **WHEN** a keyboard-only user completes setup, create item, lock, and unlock
- **THEN** every action is reachable without a pointer

#### Scenario: Dialog close
- **WHEN** a dialog closes
- **THEN** focus returns to the control that opened it or the next safe heading

### Requirement: Semantic forms, errors, and live regions

Inputs SHALL have accessible names, error text SHALL be associated with the affected control, and status/toast messages SHALL be announced through a live region. Headings and landmarks SHALL be ordered and unique.

#### Scenario: Invalid form
- **WHEN** a form field fails validation
- **THEN** its control references the visible error and exposes its invalid state

#### Scenario: Toast announcement
- **WHEN** a success or failure toast appears
- **THEN** assistive technology receives the message through a live region

### Requirement: Contrast and focus visibility

Text, controls, and focus indicators SHALL meet WCAG 2.1 AA contrast and remain visibly focused in light and dark themes.

#### Scenario: Focus ring
- **WHEN** a keyboard user focuses a control
- **THEN** a visible focus indicator meets contrast requirements

#### Scenario: Theme contrast
- **WHEN** either theme is selected
- **THEN** body and interactive text meet AA contrast
