## ADDED Requirements

### Requirement: prepublishOnly script gates publish on CI pass
`package.json` SHALL contain a `prepublishOnly` script that runs `npm run ci`, ensuring typecheck, lint, lint:custom, and test:coverage all pass before `npm publish` proceeds.

#### Scenario: Publish blocked when CI fails
- **WHEN** `npm publish` is run and `npm run ci` exits non-zero (any check fails)
- **THEN** npm aborts the publish and reports the failure

#### Scenario: Publish proceeds when CI passes
- **WHEN** `npm publish` is run and `npm run ci` exits zero
- **THEN** npm continues with the pack and publish steps

#### Scenario: prepublishOnly does not run on npm install from registry
- **WHEN** a consumer runs `npm install @agentic/bp` from the npm registry
- **THEN** `prepublishOnly` does not execute (npm lifecycle semantics guarantee this)

### Requirement: prepare script builds on dev install
`package.json` SHALL contain a `prepare` script that runs `npm run build`, ensuring `dist/` is generated when the package is installed from source (e.g., `npm link`, monorepo local reference).

#### Scenario: Build runs on npm link
- **WHEN** a developer runs `npm link` in the project directory
- **THEN** `npm run build` executes and `dist/` is populated

#### Scenario: prepare does not run for consumers
- **WHEN** a consumer installs `@agentic/bp` from the npm registry tarball
- **THEN** the `prepare` script does not execute

### Requirement: CI script is the single source of truth for quality gate
The `ci` script SHALL remain the canonical quality gate referenced by `prepublishOnly`, so any future additions to `ci` (e.g., new lint checks) are automatically included in the publish gate.

#### Scenario: New check added to ci propagates to publish gate
- **WHEN** a new check is appended to the `ci` script in `package.json`
- **THEN** running `npm publish` automatically runs the new check via `prepublishOnly`
