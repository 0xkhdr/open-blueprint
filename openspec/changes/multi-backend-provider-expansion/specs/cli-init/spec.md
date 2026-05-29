## MODIFIED Requirements

### Requirement: `bp init` positional backend argument accepts all 28 IDs
`bp init <backend>` and `bp init --tool <backend>` SHALL accept any of the 28 backend IDs registered in the backend registry. The `SUPPORTED_BACKENDS` constant SHALL be derived from `listBackendIds()` in the registry.

#### Scenario: All 28 backends accepted as positional argument
- **WHEN** `bp init windsurf` is run
- **THEN** it proceeds to scaffold the windsurf backend without a "Unsupported backend" error

#### Scenario: Validation uses registry, not hardcoded list
- **WHEN** a new backend is added to the registry
- **THEN** `bp init <new-backend>` automatically accepts it without any change to `init.ts`

#### Scenario: Invalid backend exits with error
- **WHEN** `bp init unknowntool` is run
- **THEN** it exits non-zero with an error listing valid options
