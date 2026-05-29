## ADDED Requirements

### Requirement: Single authoritative navigation index
The documentation suite SHALL have exactly one top-level navigation index at `README.md` (repo root). All other files that duplicate navigation content SHALL be removed. Every documentation file in `docs/` SHALL be reachable from this index within one link.

#### Scenario: Developer finds getting-started from root
- **WHEN** a developer opens the repo root on GitHub
- **THEN** `README.md` renders with a visible link to `docs/getting-started.md`

#### Scenario: No secondary navigation indices exist
- **WHEN** a link checker scans the repo for files named `README.md`
- **THEN** only one `README.md` exists (at repo root); `docs/README.md` and `docs/00-README.md` do not exist

---

### Requirement: Semantic filenames in docs/
All files in `docs/` SHALL use kebab-case semantic names without numeric prefixes. Example: `getting-started.md`, not `01-getting-started.md`.

#### Scenario: No numeric prefix filenames remain
- **WHEN** a glob `docs/[0-9][0-9]-*.md` is run against the repo
- **THEN** zero files match

#### Scenario: Existing content preserved after rename
- **WHEN** each renamed file is diffed against its predecessor (content only, not filename)
- **THEN** no headings, code blocks, or substantive paragraphs are missing

---

### Requirement: Merged troubleshooting reference
Exit codes and troubleshooting guidance SHALL live in a single file `docs/troubleshooting.md`. The files `docs/10-troubleshooting.md` and `docs/18-errors.md` SHALL not exist after migration.

#### Scenario: All exit codes present in merged file
- **WHEN** exit codes 0–10 are searched in `docs/troubleshooting.md`
- **THEN** each code has a description, symptom, and resolution step

#### Scenario: No duplicate exit code entries
- **WHEN** `docs/troubleshooting.md` is parsed for exit code table rows
- **THEN** each code 0–10 appears exactly once

---

### Requirement: Observability doc free of internal project-tracking language
`docs/observability.md` SHALL NOT contain phase names, sprint estimates, engineer-day counts, or "Implementation complete" status headers. Content SHALL be scoped to user-facing reference material only.

#### Scenario: No phase metadata in observability doc
- **WHEN** `docs/observability.md` is grepped for the pattern `Phase \d` or `engineer-days`
- **THEN** zero matches are returned

#### Scenario: Observability doc under line budget
- **WHEN** `docs/observability.md` line count is measured
- **THEN** line count is 200 or fewer

---

### Requirement: ADR and API docs reachable from root README
`docs/adr/` and `docs/api/` SHALL each have a section or entry in the root `README.md` navigation.

#### Scenario: ADR section visible in root README
- **WHEN** root `README.md` is parsed for the string `docs/adr`
- **THEN** at least one link to a file under `docs/adr/` is present

#### Scenario: API docs section visible in root README
- **WHEN** root `README.md` is parsed for the string `docs/api`
- **THEN** at least one link to a file under `docs/api/` is present

---

### Requirement: CI documentation health check
A GitHub Actions job named `docs-health` SHALL run on every pull request. It SHALL fail the PR if any of the following are true: (a) markdown lint errors, (b) broken internal links.

#### Scenario: Broken internal link fails CI
- **WHEN** a PR introduces a link to `docs/nonexistent.md`
- **THEN** the `docs-health` CI job exits non-zero and blocks merge

#### Scenario: Markdown lint violation fails CI
- **WHEN** a PR adds a heading that skips a level (e.g., H1 → H3)
- **THEN** the `docs-health` CI job exits non-zero

#### Scenario: Valid PR passes docs health check
- **WHEN** all links are valid and markdown is lint-clean
- **THEN** the `docs-health` CI job exits zero

---

### Requirement: Documentation style guide
A file `docs/style-guide.md` SHALL exist and SHALL cover: heading hierarchy rules, code fence language tag requirements, cross-linking format, and tone guidelines (second-person, imperative for instructions).

#### Scenario: Style guide file exists
- **WHEN** the repo is checked out
- **THEN** `docs/style-guide.md` exists and is non-empty

#### Scenario: Style guide covers required sections
- **WHEN** `docs/style-guide.md` is parsed for H2 headings
- **THEN** headings for "Headings", "Code Examples", "Cross-Links", and "Tone" (or equivalent) are all present

---

### Requirement: CHANGELOG.md at repo root
A `CHANGELOG.md` file SHALL exist at repo root following the Keep-a-Changelog format. It SHALL contain an `[Unreleased]` section.

#### Scenario: CHANGELOG exists
- **WHEN** the repo root is listed
- **THEN** `CHANGELOG.md` is present

#### Scenario: CHANGELOG has unreleased section
- **WHEN** `CHANGELOG.md` is parsed
- **THEN** an `## [Unreleased]` section is present
