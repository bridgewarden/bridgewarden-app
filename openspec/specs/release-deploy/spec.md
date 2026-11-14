# release-deploy Specification

## Purpose
Makes the deployed Worker version and the remote D1 schema an explicit compatibility pair, with a deploy path that fails before shipping incompatible code.

## Requirements

### Requirement: Deploy checks remote migrations

The deploy path SHALL reject an upload when local migrations are not applied remotely or when the Worker cannot confirm a compatible schema version. The check MUST run before `wrangler deploy` publishes code.

#### Scenario: Pending migration blocks deploy

- **WHEN** a local migration has not been applied to the remote D1 database
- **THEN** the deploy command exits non-zero before publishing the Worker

### Requirement: Schema compatibility is observable

The deployment SHALL expose a schema/version canary that operators can read without touching user data, so forward and rollback skew are detectable.

#### Scenario: Canary reports incompatibility

- **WHEN** the running Worker expects a migration that the remote schema lacks
- **THEN** the canary reports the mismatch and the deploy/rollback runbook directs the operator to migrate first
