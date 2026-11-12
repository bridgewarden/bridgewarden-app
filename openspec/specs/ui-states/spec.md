# ui-states Specification

## Purpose
Defines reusable loading, empty, error, and offline presentation for vault surfaces, plus a safe global error boundary with generic copy and retry behavior.

## Requirements

### Requirement: Shared state components

The client SHALL provide shared empty, skeleton-list, inline-error, error-toast, and offline-banner components. Each MUST use catalog-backed copy, keep actions keyboard accessible, and be reusable by vault, editor, trash, generator, and settings surfaces.

#### Scenario: Empty vault
- **WHEN** a surface has no content and is ready
- **THEN** it renders the shared empty state with any relevant action

#### Scenario: Loading surface
- **WHEN** a surface is loading
- **THEN** it renders a skeleton with dimensions matching the final content

#### Scenario: Inline failure
- **WHEN** a form or surface operation fails locally
- **THEN** the shared inline error shows a catalog message without raw server text

### Requirement: Offline banner

The app SHALL show a global offline banner when the browser loses connectivity and MUST retain readable cached vault data. The banner SHALL clear when connectivity returns.

#### Scenario: Network loss
- **WHEN** the browser goes offline
- **THEN** the offline banner appears while cached items remain readable

#### Scenario: Network return
- **WHEN** connectivity returns
- **THEN** the banner clears and sync may resume

### Requirement: Generic server error presentation

User-facing errors MUST map to catalog messages and MUST NOT render raw server responses, exception objects, stack traces, plaintext, tokens, or ciphertext. Server failures SHALL offer a retry action where retry is meaningful.

#### Scenario: Simulated 500
- **WHEN** a vault operation returns a 500
- **THEN** a generic error with retry is shown and no raw response appears in the page

#### Scenario: Global toast
- **WHEN** a background vault operation fails
- **THEN** the global toast reports a generic failure

### Requirement: Root error boundary

The root error boundary SHALL render catalog-backed copy and a retry or safe navigation action. It MUST NOT render an error stack, raw payload, or request identifier in HTML.

#### Scenario: Route error
- **WHEN** a route throws an unrecoverable error
- **THEN** the boundary renders a generic message and a retry action

#### Scenario: Missing route
- **WHEN** a route is not found
- **THEN** the boundary renders the not-found copy

#### Scenario: Production redaction
- **WHEN** the boundary renders in production
- **THEN** no stack trace, raw error message, or payload is included in HTML

### Requirement: Server error logging

The Worker SHALL log server-side error identity without request bodies, vault plaintext, tokens, ciphertext, or user secrets. Logged details MUST NOT be used as user-facing copy.

#### Scenario: Server exception
- **WHEN** the Worker request handler throws
- **THEN** a redacted server-side log is emitted and the client receives only generic failure UI
