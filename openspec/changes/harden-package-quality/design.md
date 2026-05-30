## Context

`@agentic/bp` v1.0.0 is a CLI-only package published to npm. Three structural quality gaps exist:

1. **No `exports` map** — `package.json` has only `main: ./dist/cli/index.js`. Consumers can `import "@agentic/bp/dist/validator/index"` or any other internal path. There is no encapsulation, no TypeScript type entry, and no `sideEffects` hint for bundlers.

2. **No publish lifecycle guards** — No `prepublishOnly` or `prepare` script. `npm publish` runs with whatever is in `dist/` at the time, even a stale or absent build. No gate enforces CI before publish.

3. **Branch coverage below threshold** — `vitest.config.ts` declares 75% branch threshold; current run is 74.82%. Root causes: `src/utils/input.ts` (16.66% lines), `src/utils/errors.ts` (40% lines), `src/validator/rules/backend-rules.ts` (48.14% lines/branches). Additionally, `src/cli/ui/**` and `src/cli/commands/**` are excluded wholesale — 20+ command files with zero measured coverage.

## Goals / Non-Goals

**Goals:**
- Lock the public API surface via `exports` map; block internal path imports from consumers
- Add `types` and `sideEffects` fields for TypeScript consumers and bundlers
- Add `prepublishOnly` and `prepare` lifecycle scripts to gate publishes on CI pass
- Write targeted unit tests for `input.ts`, `errors.ts`, `backend-rules.ts` to clear the branch threshold
- Lift branch threshold from 75% to 80% after clearing existing failures
- Replace broad CLI exclusions with targeted per-file exclusions (only structurally un-testable code)

**Non-Goals:**
- Refactoring CLI command implementations
- Adding new CLI features or options
- Converting package to dual CJS/ESM (package is already pure ESM `"type": "module"`)
- Publishing a new version (scope stops at code changes; release is manual)

## Decisions

### D1: Single `exports` entry pointing to CLI entrypoint

**Decision**: `exports` map exposes only `"."` → `./dist/cli/index.js` (with types at `./dist/cli/index.d.ts`).

**Rationale**: `@agentic/bp` is a CLI tool, not a library. There is no intended programmatic API for consumers. A single export entry enforces this contract. If a future programmatic API is added, it gets its own explicit export path at that time.

**Alternative considered**: Expose `./dist/validator/index.js` as `"./validator"` for consumers who want to use the validator programmatically. Rejected — no documented consumer use case exists; adding it now would lock an undocumented internal API.

### D2: `prepublishOnly` runs full CI, `prepare` runs only build

**Decision**: `prepublishOnly: "npm run ci"` (typecheck + lint + lint:custom + test:coverage), `prepare: "npm run build"`.

**Rationale**: `prepublishOnly` triggers on `npm publish` and must enforce the full quality gate. `prepare` triggers on `npm install` in dev/linked setups and must be fast — build only, no tests.

**Alternative considered**: `prepublishOnly: "npm run build && npm run test"`. Rejected — skips lint and typecheck, misaligns with the existing `ci` script which already chains all checks.

### D3: Cover `backend-rules.ts` with integration-style unit tests

**Decision**: Write unit tests that call `BACKEND_RULES[n].check(projectRoot, backends)` directly against fixture directories rather than mocking the filesystem.

**Rationale**: `backend-rules.ts` uses `fs.existsSync`, `fs.readdirSync`, and `gray-matter` against real paths. Mocking these has historically caused divergence (noted in existing test suite comments). Using `os.tmpdir()` fixture dirs makes tests authoritative.

**Alternative considered**: Mock `node:fs` with `vi.mock`. Rejected — consistency with existing integration test pattern in `tests/integration/`.

### D4: Raise branch threshold to 80% after fixes

**Decision**: After the three low-coverage files are fixed, raise `branches` threshold from 75% → 80%.

**Rationale**: Current 74.82% is already below the stated 75% threshold — the threshold is aspirational, not maintained. Fixing the identified gaps brings coverage to ~80%+; locking the threshold there prevents future regression.

**Alternative considered**: Keep at 75% as a conservative target. Rejected — a threshold that current code already fails is noise, not a gate.

### D5: Remove broad CLI exclusions, keep only exit-path exclusions

**Decision**: Remove `src/cli/ui/**` and `src/cli/commands/**` from `coverage.exclude`. Add back only specific files/lines where coverage is structurally impossible (e.g., `process.exit()` branches in `src/cli/index.ts`).

**Rationale**: Blanket CLI exclusion hides 20+ command files from coverage metrics entirely. The commands can and should have integration tests or at minimum snapshot tests for their output. Removing the exclusion surfaces the true coverage picture.

**Alternative considered**: Keep exclusions and only fix the three named files. Rejected — fixing the threshold while hiding CLI gaps defeats the purpose of the threshold.

## Risks / Trade-offs

- **BREAKING for internal-path consumers** → `exports` map blocks imports like `require("@agentic/bp/dist/validator")`. No documented consumer use cases of this exist (CLI tool, not library), but cannot rule out undocumented usage. Mitigation: CHANGELOG entry, semver major if needed.

- **Removing CLI exclusions may reveal new threshold failures** → CLI commands currently have 0% measured coverage. Removing exclusions before adding CLI tests could drop overall coverage below the new 80% threshold. Mitigation: remove exclusions and write CLI smoke tests in the same PR; fall back to targeted per-file exclusions with inline `/* v8 ignore */` if a specific branch is truly unreachable.

- **`prepare` runs on `npm install`** → Adds build step to all installs from source (e.g., `npm link`, monorepo local refs). Mitigation: `prepare` is skipped when installing from the npm registry tarball, so published consumers are unaffected.

## Migration Plan

1. Update `package.json` — add `exports`, `types`, `sideEffects`, `prepare`, `prepublishOnly`
2. Update `vitest.config.ts` — remove broad exclusions, adjust thresholds
3. Write new unit tests for `input.ts`, `errors.ts`, `backend-rules.ts`
4. Write CLI command smoke/snapshot tests to compensate for removed exclusions
5. Run `npm run ci` locally to confirm full pass
6. PR review → merge → manual `npm publish` (no automated release change in this scope)

**Rollback**: All changes are in `package.json`, `vitest.config.ts`, and new test files. No runtime behavior changes. Rollback = revert PR.

## Open Questions

- Should a `./validator` subpath export be added for programmatic use? (Deferred — no current consumer need documented; create a separate proposal if needed.)
- Should `prepublishOnly` also run `npm run sbom` to regenerate the SBOM before publish? (Left out of this scope; SBOM generation is slow and separate from quality gates.)
