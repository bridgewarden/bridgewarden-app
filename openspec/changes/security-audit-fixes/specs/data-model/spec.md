# Spec Delta

## MODIFIED Requirements

### Requirement: Audit event storage

The system SHALL record audit events with an optional user reference, event type, hashed network identifiers, optional caller-supplied metadata, and a timestamp. The stored row MUST preserve that metadata. Event metadata MUST NOT contain credentials, tokens, ciphertext, or vault content.

#### Scenario: User deletion keeps the event
- **WHEN** the referenced user is deleted
- **THEN** the audit event remains with a null user reference

#### Scenario: Caller metadata preserved
- **WHEN** an admin mutation supplies `{targetUserId}` or an invitation supplies `{invitationId}`
- **THEN** the stored audit row contains that JSON metadata

#### Scenario: No secrets in metadata
- **WHEN** any audit event is written
- **THEN** its metadata contains no email, password, token, TOTP code, or ciphertext
