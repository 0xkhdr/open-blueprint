# open-blueprint Improvement Roadmap

This directory holds the analysis and staged implementation plan for closing the gap
between open-blueprint's governance promises and its delivered behavior, and for adding
client-authored skills and rules validated under the bp umbrella.

## How to use in a fresh context

For each stage, start a fresh session and prompt:

> Read `roadmap/00-analysis.md`, then implement `roadmap/stages/stage-N-<name>/spec.md`
> following `tasks.md` in the same directory. Keep `npm run ci` green.

Stages are designed to be implemented and merged independently, in order.

## Contents

| Path | Purpose |
|---|---|
| `00-analysis.md` | Domain model, governance pillars, gap analysis (GAP-1…GAP-6), conventions, stage dependency graph |
| `stages/stage-1-executable-rules/` | Executable rule condition DSL — make `bp verify` actually enforce rules (GAP-1) |
| `stages/stage-2-custom-rule-packs/` | Client-authored rule packs: on-disk format, create/lint/install (GAP-2) |
| `stages/stage-3-skill-authoring/` | `bp skill` command group + skill validation + skill packs (GAP-3) |
| `stages/stage-4-plugin-api/` | Real `@agentic/bp/plugin` API, fixed loader, honest sandbox (GAP-4) |
| `stages/stage-5-pack-distribution/` | Signed pack publish/install, trust policy, real registry protocol (GAP-5) |
| `stages/stage-6-governance-reporting/` | Compliance reports, per-rule SARIF, pack drift (GAP-6) |

## Dependency order

```
1 ──► 2 ──► 3 ──► 5 ──► 6 (full)
│                 ▲
└──► 4 ───────────┘ (4 independent after 1; 5 verifies plugins too)
6 minimally needs 1+2 only.
```

## Definition of done (every stage)

- `npm run ci` passes (typecheck, biome, custom lints, coverage).
- New external data validated with Zod; async fs only; no `process.exit` outside `src/cli/index.ts`.
- Docs updated in the same stage — no documented-but-unimplemented surface remains for the touched area.
- New CLI commands registered in `src/cli/index.ts` and documented in `docs/commands.md`.
