## Why

Documentation for `open-blueprint` (`bp`) was modelled on the `open-spec` (`opsx`) repository, leaving stale references to `opsx`/`openspec` command invocation patterns and `.opsx`-nested paths throughout `README.md` and `docs/supported-tools.md`. These references belong to a different package and mislead users about how `bp` actually works.

## What Changes

- Replace all `/opsx:<workflow>` invocation syntax examples in `README.md` with `/bp:<workflow>` equivalents.
- Replace all `/opsx-<workflow>`, `/openspec-<workflow>`, and `/skill:openspec-<workflow>` examples in `README.md` with `bp`-prefixed patterns.
- Fix the Command Syntax Reference table in `docs/supported-tools.md` (lines 47–50): update Pattern and Example columns to use `bp` prefix instead of `opsx`/`openspec`.
- Fix Skill-Only Backends section in `docs/supported-tools.md` (lines 112–114): replace `openspec` invocation syntax descriptions with `bp`-prefixed equivalents.
- Audit and correct the five backends whose Skills/Commands paths reference `.opsx` subdirectories (`codebuddy`, `costrict`, `crush`, `lingma`, `qoder`): verify whether these tools actually use `.opsx`-named internal directories or whether those paths were copied verbatim from Open Spec docs and should be corrected to flat tool-native paths.
- Update Notes column entries for the affected rows (currently say "Nested opsx" / "Deep nested") to accurate, `bp`-neutral descriptions.

## Capabilities

### New Capabilities

- `docs-command-syntax-correctness`: Ensures all command invocation syntax examples in documentation use `bp`-prefixed patterns that match the actual CLI binary, with no stale `opsx`/`openspec` references.

### Modified Capabilities

<!-- No existing spec-level requirements are changing. -->

## Impact

- `README.md` — Supported Backends table (lines 104–123): Command Syntax column values.
- `docs/supported-tools.md` — Backend Compatibility Matrix rows for `codebuddy`, `costrict`, `crush`, `lingma`, `qoder` (Skills Path, Commands Path, Notes columns); Command Syntax Reference table (lines 45–50); Skill-Only Backends prose section (lines 110–114).
- No source code, APIs, or tests are affected — documentation-only change.
