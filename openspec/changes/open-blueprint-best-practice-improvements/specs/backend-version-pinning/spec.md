## ADDED Requirements

### Requirement: BackendConfig declares version compatibility
`BackendConfig` in `src/backends/registry.ts` SHALL include optional fields `minVersion?: string` (semver string) and `testedVersions?: string[]` (array of semver strings). These fields describe the range of backend tool versions the adapter has been validated against.

#### Scenario: BackendConfig accepts minVersion
- **WHEN** a `BackendConfig` is defined with `minVersion: "0.43.0"`
- **THEN** the schema parses successfully
- **THEN** the field is accessible on the config object

#### Scenario: BackendConfig accepts testedVersions list
- **WHEN** a `BackendConfig` is defined with `testedVersions: ["0.43.0", "0.44.0", "1.0.0"]`
- **THEN** the schema parses successfully
- **THEN** the list is accessible as an array of strings

### Requirement: Backend version is detected and compared at runtime
During `bp detect` or `bp verify`, `bp` SHALL attempt to detect the installed version of each configured backend tool. Detected version SHALL be compared against `minVersion` and `testedVersions`. If the detected version is below `minVersion` or not in `testedVersions`, `bp` SHALL emit a structured warning (not an error). Detection failure (tool not installed, version not parseable) SHALL be silently ignored.

#### Scenario: Warning on version below minVersion
- **WHEN** a backend tool is installed at version `0.40.0` and `BackendConfig.minVersion` is `0.43.0`
- **THEN** `bp` emits a `logger.warn` with the backend name, detected version, and minimum version
- **THEN** `bp` does not exit with a non-zero code due to this warning alone

#### Scenario: Warning on untested version
- **WHEN** a backend tool is installed at version `1.5.0` and `testedVersions` only lists `["0.43.0", "0.44.0"]`
- **THEN** `bp` emits a structured warning that the version has not been tested
- **THEN** processing continues normally

#### Scenario: No warning when version detection fails
- **WHEN** a backend tool's version cannot be determined (tool not installed, no version file)
- **THEN** no warning or error is emitted for version compatibility
- **THEN** `bp` proceeds normally
