# Spec Delta

## ADDED Requirements

### Requirement: Secret-free build artifacts

Build output SHALL NOT contain `.dev.vars`, `.env`, `.env.local`, or any file carrying Worker secret values. Deploy and CI SHALL verify this with a hard failure before upload, not only by deleting a known path.

#### Scenario: Secret file emitted
- **WHEN** the build emits a secret-bearing file under `build/`
- **THEN** the check fails and deploy/CI stops

#### Scenario: Clean build
- **WHEN** no secret-bearing file exists under `build/`
- **THEN** the check passes and deploy may continue
