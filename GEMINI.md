# GEMINI.md

This file provides guidance to Antigravity CLI when working with code in this repository.

[AGENTS.md](AGENTS.md) is the full contributor guide for this repo — read it when working on anything non-trivial. This file is the condensed version.

## What this is

`@agentic/bp` — a zero-runtime CLI (`bp`, entry `dist/cli/index.js`) that scaffolds, validates, and translates governance files (rules, skills, agents, hooks) for 31 agentic AI coding tools. ESM TypeScript, Node ≥20 / Bun ≥1.0.

## Commands

```bash
npm run build            # tsc → dist/
npm run dev -- <args>    # run CLI from source via tsx (e.g. npm run dev -- verify)
npm test                 # vitest, excludes tests/e2e/**
npm run test:e2e         # e2e tests only
npm run lint             # biome check src/
npm run lint:fix         # biome check --write src/
npm run typecheck        # tsc --noEmit
npm run lint:custom      # CI-enforced greps (sync fs, process.exit, require)
npm run check:circular   # madge circular-import check
npm run ci               # typecheck + lint + lint:custom + coverage — run before PR
```

Single test file: `npx vitest run tests/unit/validator/structural.test.ts`

## Architecture

Pipeline: **Detector → Templater → Validator → Translator**, all under `src/`:

- `src/cli/` — Commander CLI. One file per command in `cli/commands/`. `index.ts` is the **only** file allowed to call `process.exit`.
- `src/detector/` — repo fingerprinting (languages, frameworks, tooling). Outputs Zod `Fingerprint`. Static analysis only: no network, no shell, no code execution (same constraint applies to rule enforcement).
- `src/templater/` — Handlebars scaffolding with block-level merge (`bp-generated` / `bp:preserve` markers). Writes `.bp-fingerprint.json`.
- `src/validator/` — six levels: structural, semantic, logical, enforcement, drift, governance (`index.ts` orchestrates; rule `check` evaluation in `checks/`).
- `src/translator/` — backend-neutral `BlueprintIR` (`ir.ts`, Zod) + per-backend adapters in `translator/adapters/` (shared bases in `adapters/base/`).
- `src/backends/registry.ts` — per-tool ids, paths, command syntax for all 31 backends.
- `src/packs/`, `src/registry/` — pack format `bp-pack/1`, lockfile `.bp/packs.lock.json`, signed artifacts (RSA, trust keyring `~/.bp/trust.json`).
- `src/plugin/` — public plugin API (`@agentic/bp/plugin` subpath export); `src/plugins/` — loader/runner internals (worker-thread isolation).
- `src/report/` — `bp report` model (`bp-report/1`) and SARIF serializer.
- `src/errors.ts` / `src/constants.ts` — `BpError` hierarchy and exit-code contract.

Tests in `tests/` (`unit/`, `integration/`, `e2e/`, property tests via fast-check). Shipped templates in `templates/`.

## Hard conventions (CI fails on violation)

- No sync fs (`readFileSync` etc.) in the hot-path files listed in the `lint:no-sync-fs` script in `package.json` — use `node:fs/promises`.
- No `process.exit` outside `src/cli/index.ts` — throw a `BpError` subclass; the CLI entry maps it to an exit code.
- No `require()` in `src/` (ESM only; exceptions listed in the lint script).
- No circular imports.
- Biome only for lint/format — do not introduce ESLint/Prettier config.

## Stable contracts — do not break casually

- **Exit codes 0–10** (`EXIT_CODES` in `src/constants.ts`) are public API; they, the `BpError` subclasses, and `docs/troubleshooting.md` must always agree. The `{#code-N}` anchors in `docs/troubleshooting.md` are referenced from source — never rename them.
- **Schema versions**: `Fingerprint` `"1.0"`, `BlueprintIR` `"2.0"`, `bp-pack/1`, `bp-pack-lock/1`, `bp-artifact/1`, `bp-report/1`. Bumps require migration support (`bp migrate`).
- **`@agentic/bp/plugin`** subpath export is the public plugin API surface.

## Project values

- **Honest output**: if a value cannot be measured, report it as unavailable/manual — never fabricate (synthetic metrics were removed in a production audit; do not reintroduce).
- **Fail loud**: errors carry file/line where possible and an actionable `resolution`. No silent catch-and-continue.
- **Idempotency**: re-running `bp init`/pack installs must not duplicate or destroy user content — respect `bp:preserve` blocks and the `.bp/manifest.json` ownership model.
- When changing a command's flags, update `docs/commands.md` in the same PR.
