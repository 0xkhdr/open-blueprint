## ADDED Requirements

### Requirement: Branch coverage meets the 75% vitest threshold
Test branch coverage SHALL be at or above 75% as enforced by `vitest.config.ts` thresholds. The current 74.31% value causes `npm run test:coverage` to exit non-zero; this MUST be resolved before the release.

#### Scenario: Coverage command exits successfully
- **WHEN** `npm run test:coverage` runs excluding `tests/e2e/**`
- **THEN** exit code is 0 and the coverage summary reports branches ≥ 75%

#### Scenario: New tests target the highest-leverage uncovered branches
- **WHEN** tests are added for `src/backends/adapters/base/` error paths and `src/validator/alerting.ts` threshold branches
- **THEN** overall branch coverage increases to ≥ 75% without modifying production code

### Requirement: All other coverage thresholds continue to pass
The existing passing thresholds (lines ≥ 88%, functions ≥ 89%, statements ≥ 87%) SHALL remain satisfied after adding new branch-coverage tests.

#### Scenario: Existing thresholds unaffected by new tests
- **WHEN** new unit tests are added targeting previously uncovered branches
- **THEN** lines, functions, and statements coverage values remain above their respective thresholds

### Requirement: Coverage gate is enforced in CI
The CI workflow SHALL fail if any coverage threshold is not met, preventing under-tested code from reaching the release pipeline.

#### Scenario: CI coverage step blocks release on threshold failure
- **WHEN** branch coverage falls below 75%
- **THEN** the `Test with coverage` CI step fails and no subsequent release steps execute
