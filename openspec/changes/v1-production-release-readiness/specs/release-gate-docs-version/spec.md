## ADDED Requirements

### Requirement: No public-facing docs reference "v2.0" or "open-blueprint v2.0"
All documentation files under `docs/`, `README.md`, and `CHANGELOG.md` SHALL NOT contain the strings "v2.0", "open-blueprint v2.0", or "v2 schema" in any user-visible context. Internal schema type labels that happen to include "v2" in a non-version-string context are permitted only if they refer to external third-party API paths (e.g., PagerDuty `/v2/enqueue`).

#### Scenario: backend-parity.md header version is corrected
- **WHEN** `docs/backend-parity.md` is read
- **THEN** the `Version:` metadata field reads `open-blueprint v1.0` not `open-blueprint v2.0`

#### Scenario: backend-adapter.md schema label is corrected
- **WHEN** `docs/backend-adapter.md` is read
- **THEN** the `BlueprintIRSchema` section heading reads `(v1.0)` not `(v2.0)`

#### Scenario: supported-tools.md schema label is corrected
- **WHEN** `docs/supported-tools.md` is read
- **THEN** the `.bp.json` schema description reads `v1` not `v2`

### Requirement: Docs version grep returns zero hits for prohibited patterns
A CI-amenable grep for `open-blueprint v2\|schema.*v2\|v2\.0` across all `docs/` and root markdown files SHALL return no matches.

#### Scenario: No prohibited version strings in docs
- **WHEN** `grep -r "open-blueprint v2\|schema.*v2" docs/ README.md CHANGELOG.md` is run
- **THEN** the command produces no output and exits 1 (no matches found)
