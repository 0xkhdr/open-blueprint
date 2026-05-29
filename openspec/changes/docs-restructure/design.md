## Context

The current Open Blueprint (`bp`) documentation is concentrated in a single, monolithic, and dense root `README.md` containing approximately 400+ lines. It covers everything from high-level philosophy to complex TypeScript plugin APIs. This layout leads to information overload for beginners, makes deep links to specific CLI options difficult to maintain, and does not support progressive disclosure. By transitioning to a modular, multi-page OpenSpec-style documentation architecture, the project can scale its technical content without overwhelming new users.

## Goals / Non-Goals

**Goals:**
- Separate high-level marketing and quick-start guides from detailed command references and advanced developer documentation.
- Adopt a modern, visually engaging Markdown style inspired by OpenSpec, with permalink headers, ASCII flowcharts, and verification dimensions.
- Create new guides for step-by-step onboarding (`getting-started.md`), troubleshooting exit codes (`troubleshooting.md`), and a central terminology dictionary (`glossary.md`).
- Ensure easy discoverability by preserving a comprehensive navigation index on the root `README.md`.

**Non-Goals:**
- Rewriting or modifying the code logic of Open Blueprint (`bp`).
- Changing the existing CLI option names or behavior (any CLI details shown in docs must match current CLI commands exactly).
- Publishing the documentation to an external website or hosting service (this design is focused entirely on repository-level Markdown files).

## Decisions

### Decision 1: Directory Layout & File Splitting
- **Choice:** Create a new `/docs` folder at the repository root and distribute content into 12 targeted files:
  - `README.md` (Docs folder navigation landing page)
  - `getting-started.md` (Onboarding)
  - `philosophy.md` (Design principles)
  - `concepts.md` (Core ideas)
  - `workflows.md` (Workflow patterns)
  - `commands.md` (CLI reference)
  - `configuration.md` (.bp.json schema)
  - `recipes.md` (Practical snippets)
  - `plugin-api.md` (TypeScript extensions)
  - `troubleshooting.md` (Diagnostics and exit codes)
  - `contributing.md` (Developer guide)
  - `glossary.md` (Term index)
- **Rationale:** Separating documentation by developer persona and interest level allows for progressive disclosure. Beginners only read `getting-started.md`, while advanced system integrators can jump directly to `plugin-api.md`.
- **Alternatives Considered:**
  - *Keep a single file:* Unscalable; continues cognitive overload.
  - *Fewer, larger files (e.g., 3 files):* Still merges unrelated topics (like configuration and contributing), failing the progressive disclosure goal.

### Decision 2: Visual Style Upgrades
- **Choice:** Implement custom formatting patterns from OpenSpec:
  - **Permalink Headers:** Append `Permalink: <name>` below every `H2` and `H3` header to allow easy deep-linking and indexing.
  - **Philosophy Blocks:** Use character-aligned text blocks to visually set apart core principles in `philosophy.md`.
  - **Command Quick Reference Tables:** Include summary tables at the top of reference files like `commands.md` and `recipes.md` for high-density scanning.
  - **Verification Dimension Visuals:** Design standard terminal outputs illustrating logical and structural verification dimensions.
- **Rationale:** Enhances visual scanning, readability, and the premium feel of the docs without requiring external UI frameworks.
- **Alternatives Considered:**
  - *Standard Markdown only:* Fails to provide a modern, "premium" feel that builds developer trust.
  - *Build a custom docs site (Docusaurus/GitBook):* Adds build complexity and maintenance overhead; repository-based Markdown is cleaner and more direct for developer-focused tooling.

## Risks / Trade-offs

### Risk 1: Link Rot / Broken References
- **Risk:** Splitting one file into 12 files means any existing external links to specific headers in the monolithic `README.md` will break. Also, internal references between the 12 files could easily drift and break over time.
- **Mitigation:**
  - Keep the old critical headers as small redirects or clear pointers inside the new root `README.md` landing page.
  - Rigorously check all internal Markdown relative links to ensure they resolve.
  - Recommend incorporating a Markdown link-checker in the CI suite in the future.

### Risk 2: Maintenance Overhead of Modular Files
- **Risk:** When a new CLI flag or feature is added, developers might forget to update all relevant modular files (e.g., updating `commands.md` but forgetting `recipes.md` or `getting-started.md`).
- **Mitigation:**
  - Keep clear boundaries: `commands.md` is the single source of truth for CLI options.
  - Ensure other files like `getting-started.md` use minimal, generic commands and link back to `commands.md` for full parameter references.
