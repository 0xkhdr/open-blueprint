## Why

open-blueprint has never been published to npm. Before the `v1.0.0` tag and registry push, several blockers (failing lint, branch coverage below threshold, version-history confusion in CHANGELOG/docs) must be resolved so the first impression in the npm registry is clean, trustworthy, and permanent.

## What Changes

- **Fix 29 Biome lint errors** across CLI source files (formatting violations + one `unexpected any`)
- **Fix branch coverage threshold failure** — current 74.31% branches < 75% vitest threshold; add targeted tests to close the gap
- **Correct CHANGELOG version ordering** — remove or re-label the pre-written `[2.0.0]` section that contradicts the "v1.0.0 only" mandate; promote `[Unreleased]` to `[1.0.0]`
- **Scrub "v2" references from public docs** — `docs/backend-adapter.md`, `docs/backend-parity.md`, `docs/supported-tools.md` reference schema v2.0 / open-blueprint v2.0
- **Add `publishConfig` + `.npmrc`** — npm scoped package `@agentic/bp` needs explicit `access: "public"` or private-access token; currently missing `publishConfig` in `package.json`
- **Add `SECURITY.md` and `CODE_OF_CONDUCT.md`** — absent; required for responsible-disclosure and GitHub community health score
- **Verify `NPM_TOKEN` secret is set** in repository settings before release workflow runs
- **Add npm `provenance: true`** to `@semantic-release/npm` plugin for supply-chain transparency

## Capabilities

### New Capabilities
- `release-gate-lint`: Lint violations are zero — Biome check passes with exit 0
- `release-gate-coverage`: Branch coverage meets or exceeds 75% threshold — CI `test:coverage` exits 0
- `release-gate-changelog`: CHANGELOG accurately reflects v1.0.0 as the inaugural published version
- `release-gate-docs-version`: All public-facing docs reference v1.0.0 (no v2 mentions)
- `release-gate-registry`: `package.json` publishConfig and release workflow are correctly configured for a public scoped npm publish with provenance
- `release-gate-community`: `SECURITY.md` and `CODE_OF_CONDUCT.md` exist at repo root

### Modified Capabilities

## Impact

- `src/cli/commands/convert.ts`, `src/cli/commands/sync.ts`, `src/cli/commands/verify.ts` — lint autofix targets
- `src/backends/adapters/` — lint autofix + `any` type fix
- `tests/unit/` — new branch-coverage tests for under-covered paths
- `CHANGELOG.md` — version section restructure
- `docs/backend-adapter.md`, `docs/backend-parity.md`, `docs/supported-tools.md` — version string corrections
- `package.json` — `publishConfig` addition
- `.releaserc.json` — `provenance: true` addition
- Repo root — new `SECURITY.md`, `CODE_OF_CONDUCT.md`
