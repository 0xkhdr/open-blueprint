## ADDED Requirements

### Requirement: package.json declares public access for scoped package
`package.json` SHALL include `"publishConfig": { "access": "public" }` so that the scoped package `@agentic/bp` is published as publicly installable on the npm registry without requiring authentication from consumers.

#### Scenario: publishConfig present and correct
- **WHEN** `package.json` is parsed
- **THEN** `publishConfig.access` equals `"public"`

#### Scenario: npx install succeeds without auth
- **WHEN** an unauthenticated user runs `npx @agentic/bp --version`
- **THEN** the command resolves and prints the version string without a 403 error

### Requirement: .releaserc.json includes npm provenance attestation
The `@semantic-release/npm` plugin configuration in `.releaserc.json` SHALL include `"provenance": true` so that each published npm package version carries a sigstore-backed build attestation linking it to the GitHub Actions run.

#### Scenario: Provenance flag present in release config
- **WHEN** `.releaserc.json` is parsed
- **THEN** the `@semantic-release/npm` plugin entry contains `"provenance": true`

### Requirement: NPM_TOKEN secret is configured before release workflow runs
The GitHub repository MUST have an `NPM_TOKEN` secret set to a valid npm automation token before any push to `main` triggers `semantic-release`. Absence of this secret MUST be documented as a pre-release manual check.

#### Scenario: Release workflow auth succeeds
- **WHEN** semantic-release runs in CI with a valid NPM_TOKEN
- **THEN** it authenticates to the npm registry and publishes `@agentic/bp@1.0.0` without a 401 error

#### Scenario: Missing token produces clear failure
- **WHEN** NPM_TOKEN is absent from GitHub secrets
- **THEN** the `Semantic Release` step fails with an npm auth error, not a silent publish-skip
