# Changelog

All notable changes to open-blueprint (`bp`) are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **Audit integrity**: HMAC-SHA256 signed audit log entries (`AuditLogger` class). Each entry now includes a `sig` field. Set `BP_AUDIT_HMAC_KEY` to enable verified integrity; entries without the key are written with `sig: null` and a Pino `warn` is emitted.
- **Resource limits for validator**: Pre-validation file count and total byte size guards. Configure via `BP_MAX_VALIDATION_FILES` (default 1000), `BP_MAX_VALIDATION_BYTES` (default 50 MB), `BP_VALIDATION_TIMEOUT_MS` (default 30 s).
- **Entropy-based secret scanning**: `--entropy-scan` flag on `bp verify` and `bp scan`. Also configurable via `scan.entropyEnabled: true` in `.bp.json`.
- **Zod vars validation**: Template vars are now validated for depth (max 5), string length (max 10 000 chars), and reserved Handlebars helper keys before rendering.
- New environment variables: `BP_AUDIT_HMAC_KEY`, `BP_REGISTRY_PUBLIC_KEY`, `BP_MAX_VALIDATION_FILES`, `BP_MAX_VALIDATION_BYTES`, `BP_VALIDATION_TIMEOUT_MS`.

### Changed

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

---

### Added

- `agents.md` at repo root — authoritative agent lifecycle, protocols, state, error handling, and extension points reference
- `docs/style-guide.md` — authoring standards enforced by CI markdownlint
- `CHANGELOG.md` (this file)
- `docs-health` CI job: markdownlint + lychee link validation on every PR

### Changed

- Documentation filenames: numeric prefixes (`01-` through `19-`) replaced with semantic slugs (e.g., `getting-started.md`)
- Root `README.md` is now the sole navigation index; `docs/README.md` and `docs/00-README.md` removed
- `docs/observability.md`: stripped internal phase-tracking metadata, trimmed to reference format
- `docs/troubleshooting.md`: merged `docs/10-troubleshooting.md` and `docs/18-errors.md` into a single exit-code and troubleshooting reference

### Removed

- `docs/README.md` (content migrated to root `README.md`)
- `docs/00-README.md` (content migrated to root `README.md`)
- `docs/10-troubleshooting.md` (merged into `docs/troubleshooting.md`)
- `docs/18-errors.md` (merged into `docs/troubleshooting.md`)

> **Migration note:** If you have bookmarks to the old numeric-prefixed doc URLs, see the new filenames above. The content is unchanged — only filenames were updated.

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
