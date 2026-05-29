## 1. Additive Files (No Dependencies)

- [x] 1.1 Create `docs/style-guide.md` covering headings, code fences, cross-links, and tone
- [x] 1.2 Create `CHANGELOG.md` at repo root in Keep-a-Changelog format with `[Unreleased]` section
- [x] 1.3 Create `agents.md` at repo root — agent lifecycle section
- [x] 1.4 Add communication protocols section to `agents.md`
- [x] 1.5 Add state management section to `agents.md` (fingerprint, bp:preserve)
- [x] 1.6 Add error handling section to `agents.md` (exit codes, recovery pattern)
- [x] 1.7 Add extension points section to `agents.md` (plugin API, backend adapters, hooks)
- [x] 1.8 Add backend compatibility table to `agents.md` with link to `docs/backend-parity.md`

## 2. Content Rewrites

- [x] 2.1 Rewrite `docs/06-observability.md` — strip phase metadata, trim to ≤200 lines of reference content
- [x] 2.2 Write merged `docs/troubleshooting.md` combining all content from `docs/10-troubleshooting.md` and `docs/18-errors.md` — all exit codes 0–10 present exactly once

## 3. File Renames (Semantic Slugs)

- [x] 3.1 Rename `docs/01-getting-started.md` → `docs/getting-started.md`
- [x] 3.2 Rename `docs/02-philosophy.md` → `docs/philosophy.md`
- [x] 3.3 Rename `docs/03-workflows.md` → `docs/workflows.md`
- [x] 3.4 Rename `docs/04-recipes.md` → `docs/recipes.md`
- [x] 3.5 Rename `docs/05-concepts.md` → `docs/concepts.md`
- [x] 3.6 Rename `docs/06-observability.md` → `docs/observability.md` (after rewrite in 2.1)
- [x] 3.7 Rename `docs/07-glossary.md` → `docs/glossary.md`
- [x] 3.8 Rename `docs/08-commands.md` → `docs/commands.md`
- [x] 3.9 Rename `docs/09-configuration.md` → `docs/configuration.md`
- [x] 3.10 Rename `docs/11-plugin-api.md` → `docs/plugin-api.md`
- [x] 3.11 Rename `docs/12-contributing.md` → `docs/contributing.md`
- [x] 3.12 Rename `docs/13-template-authoring.md` → `docs/template-authoring.md`
- [x] 3.13 Rename `docs/14-backend-adapter.md` → `docs/backend-adapter.md`
- [x] 3.14 Rename `docs/15-backend-parity.md` → `docs/backend-parity.md`
- [x] 3.15 Rename `docs/16-ci-integration.md` → `docs/ci-integration.md`
- [x] 3.16 Rename `docs/17-nfrs.md` → `docs/nfrs.md`
- [x] 3.17 Rename `docs/19-data-models.md` → `docs/data-models.md`

## 4. Link Updates

- [x] 4.1 Grep `docs/` for all `\d\d-` patterns and update every internal link to use new semantic filenames
- [x] 4.2 Update root `README.md` navigation links to semantic filenames
- [x] 4.3 Update links in `docs/adr/*.md` that reference renamed doc files
- [x] 4.4 Update links in `docs/api/*.md` that reference renamed doc files
- [x] 4.5 Add link to `agents.md` in root `README.md`

## 5. Navigation Index Consolidation

- [x] 5.1 Expand root `README.md` to include ADR section linking to `docs/adr/` entries
- [x] 5.2 Add API docs section to root `README.md` linking to `docs/api/` entries
- [x] 5.3 Delete `docs/README.md` (after verifying all unique content migrated to root `README.md`)
- [x] 5.4 Delete `docs/00-README.md` (after verifying all unique content migrated to root `README.md`)
- [x] 5.5 Delete `docs/10-troubleshooting.md` (after merged into `docs/troubleshooting.md`)
- [x] 5.6 Delete `docs/18-errors.md` (after merged into `docs/troubleshooting.md`)

## 6. CI Documentation Health Check

- [x] 6.1 Add `.markdownlint.yaml` config to repo root (heading-increment rule, code-fence-style rule)
- [x] 6.2 Add `.lychee.toml` config excluding localhost and anchor-only links from external checks
- [x] 6.3 Add `docs-health` job to `.github/workflows/ci.yml` running markdownlint-cli2 and lychee
- [x] 6.4 Run `markdownlint-cli2` locally across all `docs/*.md` and fix any violations
- [x] 6.5 Run `lychee --offline` locally across all `docs/*.md` and fix any broken internal links

## 7. Verification

- [x] 7.1 Confirm zero files matching glob `docs/[0-9][0-9]-*.md`
- [x] 7.2 Confirm `docs/README.md` and `docs/00-README.md` no longer exist
- [x] 7.3 Confirm `docs/troubleshooting.md` contains exit codes 0–10 with no duplicates
- [x] 7.4 Confirm `docs/observability.md` has no "Phase" or "engineer-days" strings and is ≤200 lines
- [x] 7.5 Confirm `agents.md` is linked from root `README.md`
- [x] 7.6 Confirm `docs-health` CI job passes on a clean branch
