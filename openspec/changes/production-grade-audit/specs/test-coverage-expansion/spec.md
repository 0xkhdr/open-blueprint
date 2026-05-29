## ADDED Requirements

### Requirement: Branch coverage gate at 90%
The CI pipeline SHALL enforce a minimum 90% branch coverage threshold via Vitest v8. Any PR that reduces branch coverage below this threshold SHALL be blocked from merging.

#### Scenario: Coverage gate blocks low-coverage PR
- **WHEN** a PR is opened that reduces branch coverage below 90%
- **THEN** the `test:coverage` CI job fails and the PR is blocked from merging

#### Scenario: Coverage report uploaded to Codecov
- **WHEN** tests run on the `main` branch or a PR against `main`
- **THEN** coverage data is uploaded to Codecov and the coverage badge in README reflects current status

### Requirement: E2E test suite for golden paths
An end-to-end test suite SHALL exist under `tests/e2e/` covering the primary happy-path flows for `bp init`, `bp verify`, `bp translate`, and `bp drift`. E2E tests SHALL operate against real filesystem temp directories and SHALL NOT mock internal engine modules.

#### Scenario: bp init golden path tested
- **WHEN** the E2E test for `bp init claude` runs against a temp Node.js project fixture
- **THEN** the test verifies that expected scaffold files are created, that no existing files are overwritten without consent, and that the command exits with code 0

#### Scenario: bp verify golden path tested
- **WHEN** the E2E test for `bp verify` runs against a correctly scaffolded project
- **THEN** the test verifies exit code 0 and that no validation errors are reported

#### Scenario: bp verify failure path tested
- **WHEN** the E2E test for `bp verify` runs against a project with a deliberately broken rule file
- **THEN** the test verifies a non-zero exit code and that the error message identifies the offending file

#### Scenario: bp translate round-trip tested
- **WHEN** the E2E test for `bp translate` converts a Claude blueprint to Cursor and back
- **THEN** the test verifies that the semantic content of the blueprint is preserved after the round-trip

### Requirement: Stub implementation test coverage
Every previously stubbed function that has been completed (translator adapters, hook commands) SHALL have unit tests covering: happy path, invalid input, and error propagation.

#### Scenario: Pi adapter happy path tested
- **WHEN** the Pi AI adapter unit test runs with a valid `BlueprintIR` fixture
- **THEN** the test verifies that the output conforms to the Pi schema without errors

#### Scenario: Generic adapter normalization tested
- **WHEN** the generic adapter receives a `BlueprintIR` with missing optional fields
- **THEN** the test verifies that defaults are applied and no exception is thrown

#### Scenario: Hook cycle detection unit tested
- **WHEN** the hook validator unit test provides a hook dependency graph with a cycle
- **THEN** the test verifies that `detectCycles()` returns the cycle path and does not hang

### Requirement: BpError taxonomy test coverage
Every `BpError` subclass SHALL have unit tests verifying: correct `exitCode`, correct `name`, and that the error message includes the required resolution hint fields.

#### Scenario: ValidationError tested
- **WHEN** a `ValidationError` is constructed with layer `"structural"`
- **THEN** the test verifies `exitCode === 4`, `name === "ValidationError"`, and message is non-empty

#### Scenario: NetworkError retains attempt count
- **WHEN** a `NetworkError` is constructed with `attemptCount: 3`
- **THEN** the test verifies the `attemptCount` field is accessible and equals 3

### Requirement: Snapshot regression tests for CLI output
The output of key read-only commands (`bp doctor`, `bp verify --dry-run`, `bp health`) SHALL have snapshot tests that fail when output format changes unexpectedly.

#### Scenario: bp doctor output snapshot tested
- **WHEN** `bp doctor` runs against the `tests/fixtures/node-express/` fixture
- **THEN** the output matches the stored snapshot, catching any unintended output format changes

#### Scenario: Snapshot update workflow exists
- **WHEN** an intentional output format change is made to a CLI command
- **THEN** the developer can run `vitest --update-snapshots` to update the snapshot, requiring deliberate opt-in

### Requirement: Fuzz test coverage for all engine public APIs
Property-based fuzz tests using `fast-check` SHALL cover the public entry points of all four engines (Detector, Templater, Validator, Translator) to catch crashes on adversarial inputs.

#### Scenario: Detector does not throw on arbitrary file tree
- **WHEN** the Detector fuzz test generates arbitrary collections of file paths and content snippets
- **THEN** `detectFingerprint()` either returns a valid `Fingerprint` or throws a typed `DetectionError`, never an unhandled exception

#### Scenario: Validator does not crash on malformed YAML/MD input
- **WHEN** the Validator fuzz test provides malformed YAML frontmatter in rule files
- **THEN** the validator returns a `ValidationResult` with errors, never crashes with an unhandled exception
