## ADDED Requirements

### Requirement: Drift detection runs against all configured backends
When `bp drift` (or `bp verify --check-drift`) is run, it SHALL compute drift for every backend in `.bp.json` `backends`, not only the primary.

#### Scenario: Drift checked for each backend
- **WHEN** `bp drift` is run with `backends: ["claude","cursor"]`
- **THEN** output includes a drift status entry for both `claude` and `cursor`

#### Scenario: Primary-only backends not double-checked
- **WHEN** a backend appears only in `backends` (not as `primary_backend`)
- **THEN** drift is still reported for it using the same fingerprint comparison logic

### Requirement: Drift report identifies which backend(s) drifted
The drift report SHALL identify the specific backend(s) that drifted and which files changed.

#### Scenario: Only cursor drifted
- **WHEN** `.cursor/` files were modified but `.claude/` files were not
- **THEN** drift report shows `cursor: drifted` and `claude: in sync`

### Requirement: Drift detects backend added to config without files
When a new backend is added to `.bp.json` `backends` but no corresponding skill/command files exist, drift detection SHALL report this as `missing` (not `drifted` or `in sync`).

#### Scenario: New backend missing files
- **WHEN** `windsurf` is added to `backends` but `.windsurf/` does not exist
- **THEN** drift report shows `windsurf: missing — run bp init --tools windsurf`

### Requirement: Drift detects backend removed from config with files remaining
When a backend is removed from `.bp.json` `backends` but its files still exist, drift detection SHALL report this as `orphaned`.

#### Scenario: Orphaned backend files
- **WHEN** `kiro` was removed from `backends` but `.kiro/` still exists
- **THEN** drift report shows `kiro: orphaned — run bp clean --tool kiro or add back to backends`
