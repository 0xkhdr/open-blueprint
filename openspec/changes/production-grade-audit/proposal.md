## Why

`open-blueprint` targets production CI/CD pipelines and enterprise governance workflows, but its own codebase lacks the production-grade foundations it helps others establish — no formal specs, missing observability infrastructure, stub implementations in translator/hook modules, no container strategy, and no SAST gates in CI. Closing this gap is necessary before any public 1.x release and before enterprise customers can adopt it with confidence.

## What Changes

- **Formalize specification foundation**: Write NFR specs, ADRs for core technology choices, API contracts for all four engines, data model and state machine documentation
- **Harden security surface**: Audit and fix input validation gaps, implement structured audit logging, add SAST tooling (CodeQL/Snyk) to CI
- **Implement observability infrastructure**: Replace ad-hoc `console.*` calls with structured `pino` logger, add correlation IDs, mask sensitive fields, add `bp health` endpoint for CI health checks
- **Standardize error resilience**: Unify error types and exit codes across all CLI commands, implement retry logic for network operations (marketplace, registry), add graceful shutdown
- **Expand test coverage**: Close E2E test gaps for `bp init`, `bp verify`, `bp translate` flows; add mutation testing; enforce 90% branch coverage gate in CI
- **Production DevOps pipeline**: Add multi-stage Dockerfile (non-root user), add release automation (semantic-release), add dependency vulnerability scanning with threshold gates, add SBOM generation
- **Eliminate stub implementations**: Resolve all `TODO`/`FIXME` markers in `src/translator/adapters/`, `src/validator/hook.ts`, `src/cli/commands/hook.ts`

## Capabilities

### New Capabilities

- `spec-foundation`: NFRs, ADRs, engine API contracts, data models, state machines, error taxonomy — the formal specification layer the project currently lacks
- `security-hardening`: Input sanitization for all CLI args and template variables, path traversal prevention reinforcement, audit log emission, SAST CI gates, SBOM generation
- `observability-stack`: Structured `pino` logger with correlation IDs and sensitive field masking, `bp health` command, metrics hooks for CI timing instrumentation
- `error-resilience`: Unified `BpError` hierarchy with consistent exit codes, retry strategies for external I/O (marketplace fetch, registry sync), graceful SIGTERM/SIGINT shutdown
- `test-coverage-expansion`: E2E test suite for golden paths (`init`, `verify`, `translate`, `drift`), mutation testing baseline, 90% branch coverage enforcement, snapshot regression tests
- `devops-pipeline`: Multi-stage Dockerfile with non-root user, `semantic-release` automation, `npm audit` + Snyk threshold gates, SBOM via `@cyclonedx/cyclonedx-npm`, Docker Scout scan

### Modified Capabilities

*(none — no existing specs to delta)*

## Impact

- **Files affected**: ~35 source files across `src/cli/`, `src/translator/`, `src/validator/`, `src/observability/`, plus new `src/logger.ts`, `Dockerfile`, `.github/workflows/release.yml`, `.github/workflows/sast.yml`
- **APIs**: `BpError` type becomes the public error contract; exit codes stabilized and documented
- **Dependencies**: Add `pino`, `pino-pretty` (structured logging); add `@cyclonedx/cyclonedx-npm` (SBOM); add `@semantic-release/changelog`, `@semantic-release/git` (release)
- **Breaking**: Exit code values for `bp verify` failures standardized (currently inconsistent); callers relying on undocumented codes must update
- **CI**: Pipeline gains SAST, SBOM, and Docker build jobs; coverage threshold gate blocks merge below 90% branch coverage
