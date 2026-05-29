## ADDED Requirements

### Requirement: NFR documentation
The project SHALL document non-functional requirements covering performance, scalability, reliability, and security in a dedicated `docs/nfrs.md` file accessible from the README.

#### Scenario: Performance NFR specified
- **WHEN** a developer reads `docs/nfrs.md`
- **THEN** they find explicit latency budgets for each CLI command (e.g., `bp verify` SHALL complete in under 2s for repos up to 10,000 files)

#### Scenario: Reliability NFR specified
- **WHEN** a developer reads `docs/nfrs.md`
- **THEN** they find availability requirements for the template registry and marketplace (target: 99.9% uptime for read operations)

#### Scenario: Security NFR specified
- **WHEN** a developer reads `docs/nfrs.md`
- **THEN** they find explicit OWASP Top 10 compliance statements and the threat model summary

### Requirement: Architecture Decision Records
The project SHALL maintain ADRs in `docs/adr/` using the Nygard format (Context, Decision, Consequences) for all significant technology choices.

#### Scenario: ADR exists for core technology choices
- **WHEN** a new contributor reviews the ADR directory
- **THEN** they find ADRs covering: TypeScript over JavaScript, Vitest over Jest, pino over winston, Commander over yargs, Zod for schema validation, and Handlebars for templating

#### Scenario: ADR format is consistent
- **WHEN** any ADR is read
- **THEN** it contains exactly: Title, Status (Proposed/Accepted/Deprecated/Superseded), Context, Decision, and Consequences sections

### Requirement: Engine API contracts
Each of the four engines (Detector, Templater, Validator, Translator) SHALL have a formal API contract document at `docs/api/<engine>.md` describing input/output schemas with TypeScript types and usage examples.

#### Scenario: Detector contract complete
- **WHEN** a developer reads `docs/api/detector.md`
- **THEN** they find the complete `Fingerprint` Zod schema, all detection algorithm inputs, and at least two usage examples

#### Scenario: Validator contract complete
- **WHEN** a developer reads `docs/api/validator.md`
- **THEN** they find the four validation layer descriptions (structural, semantic, logical, drift), all `ValidationResult` type shapes, and documented exit code mappings

#### Scenario: Translator contract complete
- **WHEN** a developer reads `docs/api/translator.md`
- **THEN** they find the `BlueprintIR` schema, all supported backend adapter identifiers, and a round-trip conversion example

### Requirement: Data model documentation
Core data models (Fingerprint, BlueprintIR, ValidationResult, BpError, RulePack) SHALL be documented with field-level descriptions and invariants in `docs/data-models.md`.

#### Scenario: Fingerprint model documented
- **WHEN** a developer reads `docs/data-models.md`
- **THEN** they find field descriptions, valid enum values, and a JSON example for the Fingerprint type

#### Scenario: BpError model documented
- **WHEN** a developer reads `docs/data-models.md`
- **THEN** they find the full exit code registry table with code, name, description, and example trigger for each code 0–10

### Requirement: Error taxonomy documentation
The error taxonomy SHALL be documented in `docs/errors.md` with human-readable descriptions and resolution paths for every error code.

#### Scenario: Every exit code has resolution guidance
- **WHEN** a user receives a non-zero exit code from any bp command
- **THEN** they can look up the code in `docs/errors.md` and find: what caused it, what to check, and how to fix it

#### Scenario: Error codes are linked from CLI reference
- **WHEN** a user reads `docs/commands.md`
- **THEN** each command's error section links to `docs/errors.md` for the codes it can emit

### Requirement: State machine documentation for drift detection
The drift detection state machine SHALL be documented with states, transitions, and triggers in `docs/api/validator.md` or a dedicated `docs/drift-state-machine.md`.

#### Scenario: All drift states documented
- **WHEN** a developer reads the drift state machine documentation
- **THEN** they find all states (clean, drifted, stale, unknown), transition conditions, and which commands trigger each transition
