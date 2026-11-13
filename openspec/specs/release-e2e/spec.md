# release-e2e Specification

## Purpose
Defines the release acceptance contract for the browser end-to-end suite: critical user flows, audit evidence, sensitive failure artifacts, and runtime.

## Requirements

### Requirement: Folder lifecycle acceptance

The E2E suite SHALL cover folder create, rename, and delete against local D1 while the vault is unlocked. Rename and delete SHALL use the authenticated folder API with valid ciphertext already produced by the client, and a subsequent sync SHALL reflect the result in the decrypted folder projection.

#### Scenario: Rename and delete folders

- **WHEN** the suite creates two folders through the UI and renames one with the other folder's ciphertext
- **THEN** the API accepts the rename, the vault reloads the changed ciphertext, and both decrypted names match the expected duplicate
- **AND** deleting the second folder removes it from the filter projection without deleting its items

### Requirement: Audit evidence acceptance

The E2E suite SHALL assert the audit rows produced by critical flows instead of trusting unit coverage alone. Assertions SHALL be scoped to the acting user and SHALL reject metadata containing email, item names, ciphertext, passwords, tokens, TOTP codes, or recovery material.

#### Scenario: Required audit events exist

- **WHEN** the critical-flow specs complete bootstrap, login attempts, 2FA, password change, recovery, admin mutations, session revocation, and item purge
- **THEN** each required audit event type exists exactly for the expected actor
- **AND** every asserted metadata value is null or an allowed identifier

### Requirement: Sensitive failure artifacts

The suite SHALL NOT retain traces or screenshots for authenticated, auth, 2FA, admin, recovery, or vault projects because those artifacts can capture typed plaintext and cookies. Failure artifacts SHALL remain enabled only for unauthenticated projects, and the exception SHALL be documented in the E2E README.

#### Scenario: Authenticated failure produces no plaintext artifact

- **WHEN** an authenticated or vault project fails
- **THEN** Playwright retains no trace or screenshot for that project
- **AND** the README states which projects keep failure artifacts and why the rest do not

### Requirement: E2E runtime reporting

The full E2E suite SHALL report its measured test-execution duration. The runtime budget is informational until per-worker D1 isolation lands; retries, skipped critical flows, and retry-based green runs SHALL NOT be used to hide runtime.

#### Scenario: Full suite reports runtime

- **WHEN** the E2E command runs the complete suite
- **THEN** it reports the measured test-execution duration and wall time
- **AND** every critical-flow project still runs on that invocation

### Requirement: E2E isolation

New E2E coverage SHALL run against the isolated `.wrangler/e2e` D1 state and SHALL NOT require Internet access or real Cloudflare credentials. Test data SHALL use unique names and SHALL clean up through the existing global reset.

#### Scenario: New specs run in the isolated environment

- **WHEN** the folder and audit specs run through `pnpm test:e2e`
- **THEN** they use only the local E2E D1 database and local servers
- **AND** they pass without production credentials or external network access
