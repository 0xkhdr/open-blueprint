## ADDED Requirements

### Requirement: CI runs CodeQL static analysis
`.github/workflows/ci.yml` SHALL include a `codeql` job using `github/codeql-action/analyze@v3` for JavaScript/TypeScript. The job SHALL run on every push to `main` and on pull requests.

#### Scenario: CodeQL job runs on PR
- **WHEN** a pull request is opened against `main`
- **THEN** the `codeql` CI job executes
- **THEN** findings are uploaded to the GitHub Security tab as SARIF

#### Scenario: CodeQL job fails on critical findings
- **WHEN** CodeQL detects a high-severity security finding
- **THEN** the CI check fails
- **THEN** the PR cannot be merged until the finding is resolved or dismissed

### Requirement: CI uploads bp verify SARIF results
`.github/workflows/ci.yml` SHALL include a step that runs `bp verify --format sarif > results.sarif` and uploads the result using `github/codeql-action/upload-sarif@v3`. This step SHALL run after the `build` job succeeds.

#### Scenario: SARIF upload step runs on main push
- **WHEN** a commit is pushed to `main`
- **THEN** `bp verify --format sarif` runs and produces `results.sarif`
- **THEN** the file is uploaded to GitHub Advanced Security
- **THEN** findings appear in the Security tab

#### Scenario: SARIF step handles empty results
- **WHEN** `bp verify` finds no issues
- **THEN** the SARIF output is a valid document with an empty `results[]` array
- **THEN** the upload succeeds without error

### Requirement: CI enforces no-sync-fs lint across all source files
`.github/workflows/ci.yml` SHALL run `npm run lint:no-sync-fs` as part of the `lint` job. The `lint:no-sync-fs` script SHALL target `src/**/*.ts` (all source files).

#### Scenario: lint:no-sync-fs fails CI on new sync call
- **WHEN** a PR introduces `fs.readFileSync` in any `src/**/*.ts` file
- **THEN** the `lint:no-sync-fs` check exits non-zero
- **THEN** the CI `lint` job fails
- **THEN** the PR is blocked from merging

### Requirement: CI runs property-based tests with fast-check
The `test` job in CI SHALL run property-based tests covering at minimum: `VarsSchema` (template variable validation), `computeOutputHash` (hash consistency), and the structural validation layer. Tests SHALL use `fast-check` for property generation.

#### Scenario: VarsSchema property test catches invalid inputs
- **WHEN** `fast-check` generates arbitrary objects as template variables
- **THEN** `VarsSchema.parse()` either succeeds for valid inputs or throws `TemplateVarsValidationError` for invalid ones
- **THEN** no unhandled exception escapes the schema parser

#### Scenario: computeOutputHash is deterministic
- **WHEN** `fast-check` generates arbitrary string content
- **THEN** `computeOutputHash(content)` called twice with the same input returns the same hex string
- **THEN** the output is always a 64-character lowercase hex string

### Requirement: Biome lint enforces no-global-eval rule
`biome.json` SHALL add at minimum `"noGlobalEval": "error"` under `linter.rules.security`. CI SHALL run `npx biome lint` and fail on security rule violations.

#### Scenario: eval() in source triggers lint failure
- **WHEN** a developer adds `eval(userInput)` to any source file
- **THEN** `npx biome lint` exits non-zero
- **THEN** CI fails with a `noGlobalEval` violation message

#### Scenario: vm.Script in plugin sandbox is not flagged
- **WHEN** `src/plugins/sandbox.ts` uses `new vm.Script(code)`
- **THEN** Biome does not flag it as a `noGlobalEval` violation (different API)
