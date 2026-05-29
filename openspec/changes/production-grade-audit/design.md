## Context

`open-blueprint` is a zero-runtime TypeScript CLI (Node ≥20, Bun-compatible) targeting development-time and CI-time use. It scaffolds and validates governance structures for agentic AI tools across four internal engines: Detector, Templater, Validator, Translator. The project has broad unit test coverage but lacks: a formal spec layer, structured logging, unified error taxonomy, stub-free translator adapters, containerization, and release automation. This design covers the full production-hardening pass needed before a public 1.x release.

Current state pain points:
- `console.log/warn/error` scattered across ~40 source files — no correlation, no level control, no masking
- Exit codes undocumented and inconsistent (some commands `process.exit(1)` directly, others throw)
- Five `TODO`/`FIXME` markers in translator adapters and `validator/hook.ts` indicate incomplete logic
- No Dockerfile, no SBOM, no SAST gate — CI only runs `npm audit`
- No formal requirements specs — `SPEC.md` is an execution protocol, not testable requirements

## Goals / Non-Goals

**Goals:**
- Eliminate all stub implementations and `TODO` markers in src
- Establish a unified `BpError` hierarchy with stable, documented exit codes
- Replace all `console.*` calls with structured `pino` logger (correlation IDs, masking, level env var)
- Add `bp health` command for CI health checks
- Achieve 90% branch coverage enforced as a CI gate
- Add E2E test suite covering `init`, `verify`, `translate`, `drift` golden paths
- Produce a multi-stage Dockerfile (non-root, minimal final image)
- Add SAST (CodeQL), SBOM (`@cyclonedx/cyclonedx-npm`), and semantic-release pipelines
- Write formal specs for all six new capabilities

**Non-Goals:**
- Runtime metrics export (Prometheus/OpenTelemetry) — `bp` is dev/CI-time only; heavy runtime instrumentation would violate the zero-runtime-overhead principle
- Database or persistent state — `bp` is stateless by design
- UI/dashboard for audit results — output stays CLI-native
- Changing the four-engine architecture
- Adding new backend adapters (separate change)

## Decisions

### D1: Logging — `pino` over `winston` or `consola`

**Decision**: Use `pino` with `pino-pretty` as dev transport.

**Rationale**: `pino` is the fastest structured Node logger, has a negligible bundle footprint, and produces newline-delimited JSON natively consumable by log aggregators (Datadog, Loki, CloudWatch). `winston` carries legacy baggage and is 3× heavier. `consola` is pretty but not JSON-first.

**Alternatives considered**:
- `winston`: Too heavy, plugin ecosystem fragmented
- `consola`: Great DX but not production-ready for CI JSON ingestion
- Raw `pino` without `pino-pretty`: Fine in CI but ugly in dev — use transport config for both

**Implementation**: Single `src/logger.ts` export. Level from `BP_LOG_LEVEL` env var (default `info`). Correlation ID injected via `AsyncLocalStorage`. Sensitive fields (`apiKey`, `token`, `secret`, `password`) redacted with `pino`'s `redact` option.

### D2: Error Taxonomy — `BpError` base class with typed subclasses

**Decision**: Single `src/errors.ts` module exporting `BpError` base and typed subclasses (`ValidationError`, `DetectionError`, `TranslationError`, `TemplateError`, `NetworkError`, `ConfigError`).

**Rationale**: CLI exit codes are part of the public API. Callers (CI scripts, Make rules) depend on predictable codes. Currently `process.exit(1)` is called directly in 12 places with no documentation — impossible to distinguish validation failure from unexpected crash.

**Exit code registry**:
| Code | Meaning |
|------|---------|
| 0    | Success |
| 1    | Unexpected error / uncaught exception |
| 2    | Invalid CLI arguments |
| 3    | Config parse or schema validation failure |
| 4    | Blueprint structural validation failure |
| 5    | Blueprint semantic validation failure |
| 6    | Drift detected |
| 7    | Translation/adapter failure |
| 8    | Network/registry error |
| 9    | Permission denied / path traversal blocked |
| 10   | Health check failure |

**Alternatives considered**: Generic numeric codes like `grep` (1/2 only) — too coarse for programmatic CI use.

### D3: Stub Resolution Strategy — targeted completion, not redesign

**Decision**: Complete stub logic in-place rather than redesigning the affected modules.

Files with stubs:
- `src/translator/adapters/pi.ts` — partial Pi AI schema mapping
- `src/translator/adapters/generic.ts` — generic fallback adapter missing field normalization
- `src/translator/adapters/codex.ts` — Codex adapter missing tool-use serialization
- `src/validator/hook.ts` — hook dependency graph cycle detection incomplete
- `src/cli/commands/hook.ts` — `hook list` and `hook remove` subcommands not implemented

**Rationale**: These are leaf implementations against stable interfaces. Redesign would ripple into tests. Complete them with spec coverage so future regressions are caught.

### D4: Coverage Gate — Vitest v8 + 90% branch threshold

**Decision**: Enforce 90% branch coverage as a CI blocking gate via `vitest --coverage` with `branches: 90` in `vitest.config.ts`.

**Rationale**: The current test suite covers module surface but leaves branch coverage on error paths, edge inputs, and new `BpError` paths unknown. 90% branch (not just line) coverage catches missed error branches where most production bugs hide.

**Alternatives considered**: 80% line — too easy to game with trivial assertions; mutation testing alone — valuable but slow for CI gate.

### D5: Docker — multi-stage build, `node:22-alpine` final image, non-root user

**Decision**: Two-stage Dockerfile: `builder` stage compiles TypeScript → `runner` stage copies `dist/` only.

**Rationale**: Final image should not contain `devDependencies`, TypeScript compiler, or source. `alpine` base keeps image under 100MB. Non-root `node` user satisfies CIS Docker Benchmark L1.

### D6: Release Automation — `semantic-release` over manual tagging

**Decision**: Use `semantic-release` triggered on merge to `main`, producing GitHub Release + npm publish + `CHANGELOG.md` update.

**Rationale**: Conventional commits are already the stated standard. `semantic-release` makes version bumping deterministic from commit messages, eliminating manual release toil.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `pino` adds ~60KB to install footprint | Acceptable; `bp` is a dev tool, not a shipped library. `pino-pretty` stays devDependency. |
| Changing exit codes is a breaking change for existing CI integrations | Document in `CHANGELOG.md` under BREAKING. Provide migration table. Stabilize at 1.0.0. |
| Completing stub adapters may reveal design gaps in the IR schema | Budget time for IR schema patch; stub test coverage will surface this before merge. |
| 90% branch gate may block unrelated PRs during initial ramp | Establish baseline first; set gate 5% below current measured baseline, raise to 90% once gaps filled. |
| Multi-stage Docker build requires CI docker buildx support | GitHub Actions `docker/build-push-action@v5` handles this; no custom setup needed. |

## Migration Plan

1. **Phase 1 — Spec layer**: Write all six capability spec files. No code changes. Zero risk.
2. **Phase 2 — Logger swap**: Introduce `src/logger.ts`. Replace `console.*` calls module-by-module, running tests after each batch. Logger is additive until all `console.*` removed.
3. **Phase 3 — Error taxonomy**: Introduce `src/errors.ts`. Replace `process.exit()` calls and raw `throw` with typed errors. Update CLI entry point to map `BpError.exitCode`. Run full test suite.
4. **Phase 4 — Stub completion**: Complete stubs in translator adapters and hook modules. Add unit tests for each completed path.
5. **Phase 5 — Test expansion**: Add E2E suite under `tests/e2e/`. Add mutation testing config. Measure baseline coverage; set gate.
6. **Phase 6 — DevOps**: Add Dockerfile, `.github/workflows/release.yml`, `.github/workflows/sast.yml`, `.releaserc.json`.

**Rollback**: Each phase is independently mergeable. Phases 2–4 are additive (new files introduced before `console.*` removed). Dockerfile and CI workflow files don't affect runtime behavior.

## Open Questions

- **OQ1**: Should `BP_LOG_LEVEL` default to `silent` in test environments to prevent log noise in test output, or should tests explicitly set it? (Recommendation: `silent` if `NODE_ENV=test`.)
- **OQ2**: Should `bp health` emit machine-readable JSON or human-readable text? (Recommendation: both — JSON when `--json` flag present, human otherwise, consistent with other commands.)
- **OQ3**: Pi AI adapter — is the Pi AI schema documented publicly, or must it be reverse-engineered from existing integration tests? Needs confirmation before stub completion.
