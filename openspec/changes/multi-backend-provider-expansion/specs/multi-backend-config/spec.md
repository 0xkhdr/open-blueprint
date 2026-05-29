## ADDED Requirements

### Requirement: `.bp.json` v2 supports `backends` array and `primary_backend`
`.bp.json` SHALL support a `backends` field (array of backend ID strings) and a `primary_backend` field (single backend ID string). When both are present, `primary_backend` MUST be a member of `backends`.

#### Scenario: Valid v2 config with multiple backends
- **WHEN** `.bp.json` contains `{"backends":["claude","cursor"],"primary_backend":"claude"}`
- **THEN** `bp` reads it without error and uses `claude` as the primary

#### Scenario: primary_backend not in backends
- **WHEN** `.bp.json` contains `{"backends":["cursor"],"primary_backend":"claude"}`
- **THEN** `bp verify` reports a configuration error

### Requirement: `.bp.json` v1 `backend` field is transparently migrated at read time
When `.bp.json` contains `backend` (string) but not `backends` (array), `bp` SHALL treat it as equivalent to `{"backends":[<backend>],"primary_backend":<backend>}` at read time without modifying the file.

#### Scenario: v1 single backend field reads correctly
- **WHEN** `.bp.json` contains `{"backend":"claude"}`
- **THEN** `bp` resolves `backends` as `["claude"]` and `primary_backend` as `"claude"` in memory

### Requirement: `backend_configs` allows per-backend workflow and delivery overrides
`.bp.json` SHALL support a `backend_configs` object where each key is a backend ID and the value may include `workflows` (string array) and `delivery_mode` (`"skills_and_commands"`, `"skills_only"`, `"commands_only"`).

#### Scenario: Skill-only delivery mode for kimi
- **WHEN** `.bp.json` sets `backend_configs.kimi.delivery_mode = "skills_only"`
- **THEN** `bp init --tools kimi` generates only skill files regardless of the kimi adapter's defaults

#### Scenario: Subset workflows for a backend
- **WHEN** `.bp.json` sets `backend_configs.cursor.workflows = ["propose","apply"]`
- **THEN** `bp init --tools cursor` generates only `propose` and `apply` command files for cursor

### Requirement: `bp migrate config` upgrades `.bp.json` v1 to v2
`bp migrate config` SHALL rewrite `.bp.json` in-place, converting `backend` to `backends` + `primary_backend`.

#### Scenario: Migration rewrites v1 to v2
- **WHEN** `bp migrate config` is run with `.bp.json` containing `{"backend":"claude"}`
- **THEN** `.bp.json` is updated to `{"backends":["claude"],"primary_backend":"claude"}` and `backend` field is removed
