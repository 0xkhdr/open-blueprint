## ADDED Requirements

### Requirement: Biome lint passes with zero errors
The codebase SHALL produce zero Biome lint errors when `npm run lint` is executed. All 29 existing formatting violations and the single `unexpected any` type error MUST be resolved before any commit targeting the v1.0.0 release lands on `main`.

#### Scenario: Lint command exits successfully
- **WHEN** `npm run lint` runs against the `src/` directory
- **THEN** exit code is 0 and the output contains no `×` error markers

#### Scenario: Formatter violations are auto-fixed
- **WHEN** `npm run lint:fix` is executed
- **THEN** all formatting-style errors are corrected in-place and `npm run lint` subsequently exits 0

#### Scenario: Explicit any type is replaced
- **WHEN** the single `unexpected any` error location is opened and the type annotation is replaced with a concrete type
- **THEN** `npm run lint` reports zero errors and `npm run typecheck` continues to pass

### Requirement: Lint gate is enforced in CI
The CI workflow SHALL fail the `release` job if `npm run lint` returns a non-zero exit code, preventing a lint-failing build from triggering `semantic-release`.

#### Scenario: CI lint step blocks release on failure
- **WHEN** a commit with a lint violation is pushed to `main`
- **THEN** the `Lint` CI step fails and the `Semantic Release` step does not execute
