# Changelog

All notable changes to open-blueprint (`bp`) are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **Ownership manifest (`.bp/manifest.json`)**: `bp init` now records every file it renders — path, content hash, source template, and origin — so later commands can distinguish a `managed` file from one a developer intentionally `modified`, `missing` (deleted), or `untracked` (user-authored). See `src/templater/manifest.ts`.
- **`bp adopt`**: Brings existing user-authored rules/skills/agents under ownership tracking. `--status` reports managed/modified/missing/untracked classification; `--wrap` wraps file bodies in `bp:preserve` markers; `--dry-run` and `--json` supported.
- **`bp emit`**: Round-trips a `BlueprintIR` back to governance files at the backend's canonical locations, writing through the manifest-aware writer (so emitted files honor markers, `.blueprintignore`, path safety, and ownership tracking). Reads the IR from the current project or from `--input <ir.json>`; supports `--from <backend>`, `--force`, `--dry-run`, `--json`.
- **Audit integrity**: HMAC-SHA256 signed audit log entries (`AuditLogger` class). Each entry now includes a `sig` field. Set `BP_AUDIT_HMAC_KEY` to enable verified integrity; entries without the key are written with `sig: null` and a Pino `warn` is emitted.
- **Resource limits for validator**: Pre-validation file count and total byte size guards. Configure via `BP_MAX_VALIDATION_FILES` (default 1000), `BP_MAX_VALIDATION_BYTES` (default 50 MB), `BP_VALIDATION_TIMEOUT_MS` (default 30 s).
- **Entropy-based secret scanning**: `--entropy-scan` flag on `bp verify` and `bp scan`. Also configurable via `scan.entropyEnabled: true` in `.bp.json`.
- **Zod vars validation**: Template vars are now validated for depth (max 5), string length (max 10 000 chars), and reserved Handlebars helper keys before rendering.
- New environment variables: `BP_AUDIT_HMAC_KEY`, `BP_REGISTRY_PUBLIC_KEY`, `BP_MAX_VALIDATION_FILES`, `BP_MAX_VALIDATION_BYTES`, `BP_VALIDATION_TIMEOUT_MS`.

### Changed

- **Normalized diffing**: `diffRule`/`diffSkill`/`diffPersona` (`src/ecosystem/diff.ts`) now compare prose fields (`action`, `procedure`, `rationale`, `description`, `when_to_use`, `reasoning_style`) after whitespace/line-ending normalization, so cosmetic edits no longer report as changes. Case is preserved to retain governance fidelity. Shared helper: `src/utils/normalize.ts`.
- **Honest naming**: `detectSemanticDrift` is renamed to `detectBehavioralDrift` (it measures runtime metrics, not natural-language semantics); the old name remains as a `@deprecated` alias. `computeSimilarity` (a binary identity check, never a graded score) is superseded by `isOutputIdentical`; the old name remains as a `@deprecated` alias.
- **Drift cache invalidation**: The `computeOutputHash` function in `drift.ts` now uses SHA-256 (was a 32-bit rolling hash). **Existing drift caches are invalidated on upgrade** — `bp verify` will perform a fresh full check on first run after upgrading. This is expected behaviour; the cache is a performance optimization and contains no persistent state.
- Registry public key is no longer hardcoded. Load from `BP_REGISTRY_PUBLIC_KEY` env var or `~/.bp/keys/` keyring. Without a key, signature verification is skipped with a warning.
- `AuditLogger` now propagates correlation ID from `AsyncLocalStorage` context (set at command entry in `cli/index.ts`) rather than generating a new UUID per entry.
- Sync `fs.*` calls replaced with `fsPromises` in `templater/index.ts`, `templater/writer.ts`, `templater/engine.ts`, and `validator/structural.ts`.
- `diff` package (v9) replaces the hand-rolled `generateUnifiedDiff` in `writer.ts`.

### Fixed

- Path traversal check in `init.ts` `resolveCodexCommandsPath` now uses `path.relative` with `..` prefix guard instead of `startsWith`.
- `deepFreeze` in `engine.ts` now uses `JSON.parse(JSON.stringify(obj))` round-trip to strip prototype chain before freezing.
- `NODE_ENV === "test"` production guard removed from `registry/client.ts`.
- All previously silent `catch {}` blocks in `detector/index.ts`, `validator/drift.ts`, `validator/cache.ts` now emit Pino `warn`.
- Dynamic adapter import registry in `translator/index.ts` replaces hardcoded 31-import `buildAdapterMap`.

### Documentation

- Full documentation accuracy overhaul: every doc audited against the code and CLI
  `--help` output. Fixed fabricated/stale content (wrong `Fingerprint`/`ValidationResult`
  shapes, nonexistent subcommands and flags, "4-layer" validation claims — the
  validator has six levels, wrong adapter-registration instructions, broken
  `docs/errors.md` references) and removed boilerplate cruft.
- `AGENTS.md` rewritten as an honest contributor/agent guide for this codebase
  (commands, architecture map, CI-enforced conventions, stable contracts),
  replacing the earlier speculative "agent lifecycle/protocols" reference.
- New `docs/README.md` index organized by audience; new `docs/errors.md` stub so
  legacy `docs/errors.md#code-N` resolution links resolve.
- Earlier docs work (same release): semantic doc filenames replacing numeric
  prefixes, `docs/style-guide.md`, this `CHANGELOG.md`, and the `docs-health` CI
  job (markdownlint + lychee).

---

## [1.0.0] — 2026-05-28

### Added

- CI/CD pipeline with Docker support
- Error handling utilities and security utils
- Extensive test coverage (95%+)
- Logger integration and lint rules
- Backend Feature Parity Matrix (`docs/backend-parity.md`)
- ADR series (ADR-001 through ADR-006)
- API reference docs (`docs/api/`)

### Changed

- Renamed docs with numeric prefixes for ordering
- Updated imports, CLI formatting, and test framework
