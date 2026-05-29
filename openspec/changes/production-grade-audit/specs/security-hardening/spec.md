## ADDED Requirements

### Requirement: CLI argument input validation
All CLI command arguments and options that accept user-supplied strings SHALL be validated and sanitized before use. Path arguments SHALL be resolved to absolute paths and checked against an allowlist of permitted directories.

#### Scenario: Path traversal blocked
- **WHEN** a user passes `--output ../../etc/passwd` to any bp command
- **THEN** the command exits with code 9, emits an error message identifying the traversal attempt, and writes nothing to the filesystem

#### Scenario: Template variable sanitization
- **WHEN** a Handlebars template is rendered with user-supplied variables
- **THEN** any variable containing shell metacharacters (`$`, `` ` ``, `;`, `|`, `&`, `>`, `<`) is escaped or rejected before rendering

#### Scenario: Registry URL validation
- **WHEN** a user configures a custom registry URL in `.bp.json`
- **THEN** the URL is validated against an allowlist of permitted schemes (`https://` only) and the command fails with code 8 if the scheme is not permitted

### Requirement: Audit logging
The CLI SHALL emit structured audit log entries for all state-changing operations (file writes, config changes, template applications) to enable forensic tracing in enterprise environments.

#### Scenario: File write audited
- **WHEN** `bp init` writes a scaffold file
- **THEN** a structured log entry is emitted at `info` level containing: timestamp, command, file path, operation (create/overwrite/skip), and user identity (if available via `git config user.email`)

#### Scenario: Audit log not emitted for read-only commands
- **WHEN** `bp doctor` or `bp verify` runs without modifying any file
- **THEN** no audit log entries are emitted for file operations (only command start/end entries)

#### Scenario: Sensitive data not logged
- **WHEN** any log entry is emitted
- **THEN** fields named `apiKey`, `token`, `secret`, `password`, `credential`, or `auth` are replaced with `[REDACTED]` in all log output

### Requirement: SAST pipeline integration
The CI pipeline SHALL run Static Application Security Testing on every pull request targeting `main`, blocking merge on HIGH or CRITICAL severity findings.

#### Scenario: CodeQL scan runs on PR
- **WHEN** a pull request is opened targeting the `main` branch
- **THEN** the CodeQL JavaScript/TypeScript analysis action runs and its result is a required status check

#### Scenario: SAST blocks HIGH findings
- **WHEN** CodeQL identifies a HIGH or CRITICAL severity finding
- **THEN** the CI job fails and the PR cannot be merged until the finding is resolved or explicitly dismissed with justification

### Requirement: Dependency vulnerability scanning with threshold
The `npm audit` step in CI SHALL fail the build on any `high` or `critical` severity vulnerability in direct or transitive dependencies.

#### Scenario: High-severity dependency blocks CI
- **WHEN** `npm audit --audit-level=high` detects a HIGH vulnerability
- **THEN** the CI security job exits non-zero and the build is blocked

#### Scenario: Low-severity dependency does not block CI
- **WHEN** `npm audit` detects only LOW or MODERATE severity vulnerabilities
- **THEN** CI continues, but a summary is added to the job output as a warning

### Requirement: SBOM generation
The release pipeline SHALL generate a Software Bill of Materials (SBOM) in CycloneDX JSON format and attach it as a release artifact on every versioned release.

#### Scenario: SBOM attached to GitHub release
- **WHEN** a new version is released via semantic-release
- **THEN** a CycloneDX JSON SBOM file is generated and attached as a release asset named `sbom-<version>.json`

#### Scenario: SBOM includes all direct and transitive dependencies
- **WHEN** the SBOM is inspected
- **THEN** it contains entries for all packages listed in the resolved `node_modules` tree with their PURL identifiers

### Requirement: No hardcoded secrets
The source code and committed configuration files SHALL contain no hardcoded credentials, API keys, tokens, or passwords.

#### Scenario: Pre-commit secret scan
- **WHEN** a developer attempts to commit a file containing a string matching known secret patterns (AWS key prefix, GitHub PAT pattern, generic `password=` assignments)
- **THEN** the commit is blocked with a message identifying the file and pattern matched

#### Scenario: CI secret scan passes clean codebase
- **WHEN** the SAST pipeline scans the repository
- **THEN** no secret patterns are detected in any committed file
