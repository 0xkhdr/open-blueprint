## ADDED Requirements

### Requirement: Monorepo detection parses workspace configurations
When `src/detector/index.ts` detects monorepo indicators (`pnpm-workspace.yaml`, `lerna.json`, `nx.json`, or `package.json#workspaces`), it SHALL parse the corresponding config file to enumerate workspace package glob patterns. Glob patterns SHALL be expanded to a list of resolved package directories using `fast-glob` or Node's built-in `glob`.

#### Scenario: pnpm-workspace.yaml packages enumerated
- **WHEN** a `pnpm-workspace.yaml` exists with `packages: ["packages/*", "apps/*"]`
- **THEN** the detector resolves all directories matching those globs
- **THEN** the fingerprint includes `workspacePackages: string[]` with the resolved paths

#### Scenario: package.json workspaces enumerated
- **WHEN** `package.json` contains `"workspaces": ["packages/*"]`
- **THEN** the detector resolves matching package directories
- **THEN** the fingerprint includes `workspacePackages` with the resolved paths

#### Scenario: nx.json projects enumerated
- **WHEN** `nx.json` exists with a `projects` field (object or array)
- **THEN** the detector extracts project names/paths
- **THEN** the fingerprint includes `workspacePackages` with project root paths

#### Scenario: Monorepo with no recognized config degrades gracefully
- **WHEN** a `pnpm-workspace.yaml` exists but is empty or malformed
- **THEN** the detector logs a warning and sets `workspacePackages: []`
- **THEN** monorepo detection still reports `isMonorepo: true`

### Requirement: Blueprint coverage validated per workspace package
When `workspacePackages` is populated and `bp verify` is run at the monorepo root, `bp` SHALL check that each workspace package has a blueprint (i.e., a `.cursor/rules`, `CLAUDE.md`, or equivalent for the configured backends). Missing coverage SHALL be reported as a warning per package.

#### Scenario: All packages have blueprint coverage
- **WHEN** every resolved workspace package directory contains the expected blueprint files
- **THEN** `bp verify` reports no missing-coverage warnings

#### Scenario: Package missing blueprint coverage
- **WHEN** a workspace package directory does not contain the expected blueprint files
- **THEN** `bp verify` emits a warning: `"Package <path>: no blueprint found for backend <name>"`
- **THEN** the warning is included in SARIF output when `--format sarif` is used
