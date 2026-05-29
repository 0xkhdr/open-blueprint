## ADDED Requirements

### Requirement: TOML backends generate valid TOML command files
For backends with `fileExtension: ".toml"` (gemini, qwen), `bp init` and `bp convert` SHALL generate command files in TOML format with `.toml` extension. Generated TOML SHALL be syntactically valid.

#### Scenario: Gemini command file is valid TOML
- **WHEN** `bp init --tools gemini` is run
- **THEN** files in `.gemini/commands/opsx/` have `.toml` extension and pass TOML syntax validation

#### Scenario: Qwen command file is valid TOML
- **WHEN** `bp init --tools qwen` is run
- **THEN** files in `.qwen/commands/opsx/` have `.toml` extension and pass TOML syntax validation

### Requirement: TOML command files contain required header fields
Each generated TOML command file SHALL include at minimum: `name` (the invocation string), `description` (human-readable purpose), and the workflow body as a TOML string field.

#### Scenario: Gemini TOML has name and description
- **WHEN** `.gemini/commands/opsx/propose.toml` is generated
- **THEN** it contains `name = "/openspec-propose"` and a non-empty `description` field

### Requirement: Validator checks TOML syntax for TOML backends
`bp verify` SHALL validate TOML syntax in command files for backends with `fileExtension: ".toml"`.

#### Scenario: Invalid TOML triggers validation error
- **WHEN** `bp verify` is run and a `.toml` command file contains a syntax error
- **THEN** it reports a structural validation error identifying the file and line
