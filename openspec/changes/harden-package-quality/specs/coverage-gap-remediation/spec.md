## ADDED Requirements

### Requirement: Branch coverage threshold meets and exceeds 80%
`vitest.config.ts` SHALL declare a `branches` coverage threshold of 80%, and the test suite SHALL pass that threshold without excluding the CLI command or UI directories wholesale.

#### Scenario: CI fails when branch coverage drops below 80%
- **WHEN** the test suite runs with `npm run test:coverage`
- **THEN** vitest exits non-zero if branch coverage is below 80%

#### Scenario: Threshold passes with current codebase after fixes
- **WHEN** new tests for `input.ts`, `errors.ts`, and `backend-rules.ts` are added
- **THEN** branch coverage is at or above 80% and vitest exits zero

### Requirement: input.ts is covered by unit tests
`src/utils/input.ts` (currently 16.66% line coverage) SHALL be covered by unit tests exercising all branches of `validateUserInput`.

#### Scenario: Valid short string passes validation
- **WHEN** `validateUserInput` is called with a string of 256 characters or fewer containing no disallowed characters
- **THEN** it returns the string unchanged

#### Scenario: String exceeding max length throws InputValidationError
- **WHEN** `validateUserInput` is called with a string longer than 256 characters
- **THEN** it throws `InputValidationError` with message "Input exceeds maximum length of 256 characters"

#### Scenario: String with disallowed characters throws InputValidationError
- **WHEN** `validateUserInput` is called with a string containing control characters or null bytes
- **THEN** it throws `InputValidationError` with message "Input contains disallowed null bytes or control characters"

### Requirement: errors.ts is covered by unit tests
`src/utils/errors.ts` (currently 40% line coverage) SHALL be covered by unit tests exercising all branches of `normalizeError`.

#### Scenario: Error instance returned as-is
- **WHEN** `normalizeError` is called with an `Error` instance
- **THEN** it returns the same `Error` instance unchanged

#### Scenario: String converted to Error
- **WHEN** `normalizeError` is called with a string value
- **THEN** it returns a new `Error` whose message equals the string

#### Scenario: Unknown value converted to Error via String()
- **WHEN** `normalizeError` is called with a non-Error, non-string value (e.g., number, object, null)
- **THEN** it returns a new `Error` whose message equals `String(value)`

### Requirement: backend-rules.ts is covered by unit tests
`src/validator/rules/backend-rules.ts` (currently 48.14% line/branch coverage) SHALL be covered by unit tests that exercise each exported `BackendValidationRule`'s `check` function using temporary fixture directories.

#### Scenario: skill-only-no-commands rule detects commands dir in skill-only backend
- **WHEN** a skill-only backend (e.g., kimi, trae, forgecode) has a `commands/` directory under its backend root
- **THEN** the rule returns a `SKILL_ONLY_BACKEND_HAS_COMMANDS` ValidationError

#### Scenario: skill-only-no-commands rule passes when commands dir absent
- **WHEN** a skill-only backend has no `commands/` directory
- **THEN** the rule returns an empty errors array

#### Scenario: skill-only-no-commands rule skips unknown backend ids
- **WHEN** the backends list contains an id not registered in the backend registry
- **THEN** the rule skips that id without error and continues

#### Scenario: All backend rules return empty array for clean fixture
- **WHEN** all backend rules are run against a well-formed project fixture
- **THEN** each rule returns an empty errors array

### Requirement: CLI exclusions are replaced with targeted inline suppressions
`vitest.config.ts` SHALL NOT exclude `src/cli/ui/**` or `src/cli/commands/**` from coverage. Structurally un-testable branches (e.g., `process.exit()` paths) SHALL use inline `/* v8 ignore next */` comments rather than directory-level exclusions.

#### Scenario: CLI commands appear in coverage report
- **WHEN** the coverage report is generated
- **THEN** files in `src/cli/commands/` appear in the report with measured coverage percentages

#### Scenario: Unreachable exit branches are suppressed inline
- **WHEN** a `process.exit()` call exists in CLI code that cannot be triggered in tests
- **THEN** the line is annotated with `/* v8 ignore next */` and excluded from branch metrics without affecting the directory-level report
