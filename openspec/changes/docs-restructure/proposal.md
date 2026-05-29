## Why

The current Open Blueprint (`bp`) documentation is a single, monolithic, and dense `README.md` (~400+ lines). This creates a high cognitive load for new users, makes it difficult to find specific topics, and lacks progressive disclosure for advanced features like the plugin API and exit codes. Updating this to a modular, multi-page OpenSpec-style documentation architecture will improve onboarding, provide a dedicated philosophy narrative, offer clear workflow patterns, and scale as the project grows.

## What Changes

- **Monolithic README Split**: Extract and distribute all dense reference and guide sections from the root `README.md` to focused pages inside a new `docs/` directory.
- **New Onboarding and Guides**: Create `docs/getting-started.md` (first 5 minutes walkthrough), `docs/workflows.md` (workflow patterns), `docs/troubleshooting.md` (exit code decoder and doctor diagnostics), and `docs/glossary.md` from scratch.
- **Modern Style & Elements**: Introduce visual/stylistic upgrades inspired by OpenSpec:
  - Permalink headers on all `H2`/`H3` tags for deep linking.
  - Formatted philosophy blocks highlighting the 5 key principles.
  - Two-mode workflow framing (individual developer quick path vs team/enterprise expanded path).
  - Artifact flow diagrams for concept mapping.
  - Detailed CLI output schemas and exit code mappings.
- **Root README Restructure**: Transform the root `README.md` into a high-level landing page with a two-paragraph elevator pitch, quick start commands, a navigation index to all docs, and a supported backend matrix.

## Capabilities

### New Capabilities
- `documentation-restructure`: Restructuring the project's documentation by creating a comprehensive, multi-page, progressive-disclosure documentation system (`docs/` directory) and converting the root `README.md` into a clear landing page.

### Modified Capabilities

## Impact

- **Affected Files**:
  - `README.md` (rewritten as a landing page)
  - New directory `docs/` with all structural documents: `README.md`, `getting-started.md`, `philosophy.md`, `concepts.md`, `workflows.md`, `commands.md`, `configuration.md`, `recipes.md`, `plugin-api.md`, `troubleshooting.md`, `contributing.md`, `glossary.md`.
- **System Impact**: No code files are modified. This change is entirely focused on documentation structure, visual improvements, and content scaling.
