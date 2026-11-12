# web-performance Specification

## Purpose
Defines client bundle and runtime performance budgets for initial, vault, and unlock paths.

## Requirements

### Requirement: Bundle budgets

Initial JavaScript for unauthenticated routes MUST be under 200KB gzip and the vault route chunk under 150KB gzip. Crypto modules MUST NOT be part of the initial bundle.

#### Scenario: Initial bundle
- **WHEN** the production build is measured
- **THEN** initial unauthenticated JS is below 200KB gzip

#### Scenario: Vault bundle
- **WHEN** the vault route chunk is measured
- **THEN** it is below 150KB gzip and crypto is dynamically imported only on unlock/setup paths

#### Scenario: Budget regression
- **WHEN** a build exceeds a budget
- **THEN** the CI budget gate fails with the measured size

### Requirement: Runtime performance

Unlock derivation SHALL remain under one second p95 on a mid-range device, and LCP SHALL be under 2.5 seconds on throttled 4G.

#### Scenario: Unlock timing
- **WHEN** the benchmark runs the configured KDF
- **THEN** p95 derivation stays within the budget

#### Scenario: LCP
- **WHEN** Playwright or Lighthouse measures the throttled 4G load
- **THEN** LCP is below 2.5 seconds

### Requirement: Lazy route and component loading

Vault editor and heavy utility routes SHALL be route-split, and unused primitives SHALL be removed before measuring budgets.

#### Scenario: Route split
- **WHEN** an unauthenticated visitor loads login
- **THEN** editor and generator chunks are not requested

#### Scenario: Build report
- **WHEN** the build completes
- **THEN** the report lists route chunks and budget status
