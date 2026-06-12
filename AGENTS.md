# AGENTS.md — Working on open-blueprint

Instructions for AI coding agents (and new contributors) working on this repository.
For *user-facing* documentation of the `bp` CLI, see [docs/README.md](docs/README.md).

## What this project is

`@agentic/bp` is a zero-runtime CLI that scaffolds, validates, and translates
governance files (rules, skills, agents, hooks) for 31 agentic AI coding tools.
It is a Node.js ≥20 / Bun ≥1.0 ESM TypeScript project. The published binary is `bp`
(`dist/cli/index.js`).

## Commands

```bash
npm install              # install deps
npm run build            # tsc → dist/
npm run dev -- <args>    # run the CLI from source via tsx (e.g. npm run dev -- verify)
npm test                 # vitest, excludes tests/e2e/**
npm run test:e2e         # e2e tests only
npm run test:coverage    # coverage run (CI enforces thresholds in vitest.config.ts)
npm run lint             # biome check src/
npm run lint:fix         # biome check --write src/
npm run typecheck        # tsc --noEmit
npm run lint:custom      # project-specific greps (see "Hard conventions")
npm run ci               # typecheck + lint + lint:custom + coverage (run before PR)
```

Run a single test file: `npx vitest run tests/unit/validator/structural.test.ts`.

## Architecture map

Four core engines plus supporting modules, all under `src/`:

| Path | Role |
|---|---|
| `src/cli/` | Commander-based CLI. `index.ts` is the only file allowed to call `process.exit`. One file per command in `cli/commands/`. |
| `src/detector/` | Repo fingerprinting (languages, frameworks, tooling, security signals). Output: Zod `Fingerprint` (`fingerprint.ts`). No network, no shell. |
| `src/templater/` | Handlebars scaffolding with block-level merge (`bp-generated` / `bp:preserve` markers). Writes `.bp-fingerprint.json`. |
| `src/validator/` | Six validation levels: `structural`, `semantic`, `logical`, `enforcement`, `drift`, `governance` (`index.ts` orchestrates). Rule `check` evaluation in `checks/`. |
| `src/translator/` | Backend-neutral `BlueprintIR` (`ir.ts`, Zod, version `"2.0"`) + per-backend adapters in `translator/adapters/` (31 backends; shared bases in `adapters/base/`). |
| `src/backends/` | Backend registry (`registry.ts`) — ids, paths, command syntax per tool. |
| `src/packs/`, `src/registry/`, `src/cli/pack-install.ts` | Rule/skill pack format (`bp-pack/1`), lockfile (`.bp/packs.lock.json`), signed artifact publish/install (RSA, trust keyring in `~/.bp/trust.json`). |
| `src/plugin/` | Public plugin API (`@agentic/bp/plugin` subpath export, `definePlugin`). |
| `src/plugins/` | Plugin loader/runner internals (worker-thread isolation). |
| `src/report/` | `bp report` model (`bp-report/1`) and shared SARIF serializer. |
| `src/config/` | `.bp.json` project config (`project.ts`) and `~/.bp/config.json` user config (`user.ts`). |
| `src/errors.ts`, `src/constants.ts` | `BpError` hierarchy and the stable exit-code contract (see below). |

Tests live in `tests/` (`unit/`, `integration/`, `e2e/`, plus property tests via
fast-check). Templates shipped with the package live in `templates/`.

## Hard conventions (CI-enforced)

These are checked by `npm run lint:custom` and CI — violations fail the build:

- **No sync fs** (`readFileSync` etc.) in the hot-path files listed in the
  `lint:no-sync-fs` script in `package.json`. Use `node:fs/promises`.
- **No `process.exit`** anywhere except `src/cli/index.ts`. Throw a `BpError`
  subclass instead; the CLI entry maps it to an exit code.
- **No `require()`** in `src/` (ESM only; exceptions listed in the script).
- **No circular imports** (`npm run check:circular`, madge).
- Lint/format is Biome (`biome.json`); do not introduce ESLint/Prettier config.

## Stable contracts — do not break casually

- **Exit codes 0–10** (`src/constants.ts` `EXIT_CODES`) are public API since v1.0.0.
  The numbering, the `BpError` subclasses in `src/errors.ts`, and the registry in
  [docs/troubleshooting.md](docs/troubleshooting.md) must always agree.
- **Schema versions**: `Fingerprint` `"1.0"`, `BlueprintIR` `"2.0"`, packs
  `bp-pack/1`, lockfile `bp-pack-lock/1`, artifacts `bp-artifact/1`, report
  `bp-report/1`. Version bumps need migration support (`bp migrate`).
- **`@agentic/bp/plugin` subpath export** is the public plugin API surface.
- Error `resolution` strings in `src/` link to `docs/troubleshooting.md#code-N`
  (some legacy strings reference `docs/errors.md#code-N`; that file is a stub that
  forwards to troubleshooting — keep its anchors alive if you touch it).

## Project values (apply them to code you write)

- **Honest output over impressive output.** This codebase had a production audit
  ([docs/production-audit.md](docs/production-audit.md)) removing features that
  fabricated data (synthetic drift numbers, fake registry catalogs, invented cost
  estimates). Do not reintroduce that pattern: if a value cannot be measured, report
  it as unavailable/manual — never invent it.
- **Fail loud**: errors carry file, line where possible, and an actionable
  `resolution`. No silent catch-and-continue.
- **Static analysis only** in detector and rule enforcement: no network, no shell,
  no code execution.
- **Idempotency**: re-running `bp init`/pack installs must not duplicate or destroy
  user content — respect `bp:preserve` blocks and the `.bp/manifest.json`
  ownership model.

## Documentation rules

- `docs/troubleshooting.md` is the canonical exit-code registry; its `{#code-N}`
  anchors are referenced from source — never rename them.
- Follow [docs/style-guide.md](docs/style-guide.md) (language-tagged code fences,
  heading discipline).
- Documented behavior must match `--help` output and the code. When you change a
  command's flags, update `docs/commands.md` in the same PR.
