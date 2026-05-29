## Why

The documentation suite has grown to 25+ files with three overlapping navigation indices, split troubleshooting content, a 455-line observability doc written as an internal phase spec, and no `agents.md`, `CHANGELOG.md`, or style guide — creating friction for first-time contributors and increasing maintenance burden as the backend matrix expands.

## What Changes

- Merge the three navigation indices (`README.md`, `docs/README.md`, `docs/00-README.md`) into one authoritative root `README.md`
- Consolidate `docs/10-troubleshooting.md` + `docs/18-errors.md` into a single exit-code and troubleshooting reference
- Rewrite `docs/06-observability.md` to remove internal phase-tracking language and trim to reference format (~150 lines)
- Drop numeric filename prefixes (`00-` through `19-`) in favor of semantic names with a flat `docs/` index
- Add `agents.md` at repo root (agent lifecycle, protocols, state, error handling, extension points)
- Add `CHANGELOG.md` at repo root
- Add `docs/style-guide.md` covering tone, formatting, code example standards, and cross-linking rules
- Surface `docs/adr/` and `docs/api/` in the main docs index (currently orphaned from navigation)
- Add a CI documentation health check (markdown lint + link validation)

## Capabilities

### New Capabilities
- `doc-suite-restructure`: Consolidated documentation architecture — single navigation index, semantic filenames, progressive-disclosure hierarchy, and mandatory style guide enforced by CI
- `agents-md`: Root-level `agents.md` covering agent lifecycle, communication protocols, state management, error handling, and extension points for all supported backends

### Modified Capabilities

## Impact

- `docs/` directory: file renames, merges, and content rewrites across ~20 files
- `README.md`: restructured navigation, no content loss
- CI pipeline (`.github/workflows/ci.yml`): new `docs-health` job added
- No source code changes; no API or CLI behavior changes
