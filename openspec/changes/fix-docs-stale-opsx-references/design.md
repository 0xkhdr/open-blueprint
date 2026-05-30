## Context

`open-blueprint` (`bp`) documentation was bootstrapped from `open-spec` (`opsx`) documentation patterns. As a result, two files retain direct `opsx`/`openspec` references that are incorrect for this package:

1. `README.md` — Supported Backends table (lines 104–123) lists command invocation syntax using `/opsx:`, `/opsx-`, `/openspec-`, and `/skill:openspec-` patterns.
2. `docs/supported-tools.md` — Command Syntax Reference table (lines 45–50) and Skill-Only Backends prose (lines 110–114) use the same stale patterns. Additionally, five backend rows (`codebuddy`, `costrict`, `crush`, `lingma`, `qoder`) have Skills/Commands paths that include `.opsx`-named directories, which were copied verbatim from Open Spec's own tool registry and may not match those tools' actual filesystem conventions.

The `bp` binary is the only CLI surface this package owns. All documentation command examples must use `bp`-prefixed patterns (`/bp:<workflow>` for colon-style, `/bp-<workflow>` for hyphen-style, `bp-<workflow>` for bare, `/skill:bp-<workflow>` for skill-only).

## Goals / Non-Goals

**Goals:**
- Replace every `opsx`/`openspec` invocation syntax example with a `bp`-prefixed equivalent that matches actual tool conventions.
- Correct or clearly annotate the five backend path entries whose Skills/Commands directories reference `.opsx` internal subdirectories.
- Leave all factually correct `bp` CLI command examples (`bp init`, `bp verify`, etc.) untouched.

**Non-Goals:**
- Adding new documentation pages or reorganising the doc structure.
- Verifying the correctness of every other field in the backend compatibility matrix.
- Making changes to source code, schemas, or tests.

## Decisions

**Decision 1 — Use `/bp:` as the canonical colon-style prefix.**
Rationale: the binary is named `bp`; using the binary name as the prefix is consistent with how Claude Code names its own skill/command invocations (`/opsx:` for open-spec, `/claude:` for Claude-native). Alternatives considered: keeping `/opsx:` (rejected — wrong package), using `/blueprint:` (too long, inconsistent with the CLI name).

**Decision 2 — Derive hyphen, bare, and skill variants mechanically.**
- Colon-style → `/bp:<workflow>` (e.g., `/bp:init`)
- Hyphen-style → `/bp-<workflow>` (e.g., `/bp-init`)
- Bare → `bp-<workflow>` (e.g., `bp-init`)
- Skill-only → `/skill:bp-<workflow>` (e.g., `/skill:bp-init`)

**Decision 3 — Correct the five `.opsx`-path backends to use flat tool-native paths.**
The paths `.codebuddy/.opsx/skills`, `.costrict/config/opsx/skills`, `.crush/.opsx/skills`, `.lingma/.opsx/skills`, `.qoder/.opsx/skills` originate from Open Spec's internal registry and have not been independently verified against these tools' actual directory conventions. The correct approach is to replace `.opsx`-containing segments with the tool's own config directory pattern (e.g., `.codebuddy/skills`), update Notes from "Nested opsx" to a neutral description, and flag in code review if deeper verification is needed.

## Risks / Trade-offs

- **Path correctness for the five backends** → If any of those tools genuinely use an `.opsx`-named internal directory, changing the path would break scaffolding for that backend. Mitigation: mark the corrected paths with a `<!-- verify -->` inline comment so they can be double-checked against each tool's own documentation before the next release.
- **Example workflow names** → Using `init` as the example workflow name in syntax tables (`/bp:init`) is accurate for `bp` but may look odd since `init` is a setup-time command, not a repeated workflow. Mitigation: use `verify` as the example workflow (e.g., `/bp:verify`) since it is the most commonly run command interactively.

## Migration Plan

1. Edit `README.md` lines 106–122: replace Command Syntax column values.
2. Edit `docs/supported-tools.md` lines 47–50: update Pattern and Example in the Command Syntax Reference table.
3. Edit `docs/supported-tools.md` lines 112–114: replace `openspec` invocation descriptions with `bp`-prefixed equivalents.
4. Edit `docs/supported-tools.md` rows 23, 25, 26, 33, 35: correct Skills Path, Commands Path, and Notes for `codebuddy`, `costrict`, `crush`, `lingma`, `qoder`.
5. No rollback needed — changes are documentation-only and tracked in git.
