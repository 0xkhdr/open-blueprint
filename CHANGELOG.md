# Changelog

All notable changes to open-blueprint (`bp`) are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

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

