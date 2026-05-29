## ADDED Requirements

### Requirement: Modular documentation structure in docs directory
The project documentation SHALL be modularized by splitting the monolithic README into a dedicated `docs/` directory at the repository root. This directory MUST contain focused Markdown files for each major topic of the Open Blueprint tool.

#### Scenario: Verification of docs folder layout
- **WHEN** the documentation restructure is implemented
- **THEN** the `docs/` folder exists and contains: `README.md`, `getting-started.md`, `philosophy.md`, `concepts.md`, `workflows.md`, `commands.md`, `configuration.md`, `recipes.md`, `plugin-api.md`, `troubleshooting.md`, `contributing.md`, and `glossary.md`.

### Requirement: Root README converted to high-level landing page
The root `README.md` file SHALL be refactored to serve as a high-level landing page instead of a comprehensive reference manual. It MUST provide a concise two-paragraph introduction of the project, quick-start setup instructions, a supported backend matrix, and a navigation index linking directly to each document in the `docs/` directory.

#### Scenario: Verification of root README contents
- **WHEN** inspecting the root `README.md` file
- **THEN** it contains a two-paragraph introduction, a "Quick Start" code block, a structured "Documentation" index with links to all `docs/` subfiles, and a "Supported Backends" grid.

### Requirement: Implementation of OpenSpec style and format elements
All updated and new documentation files SHALL implement OpenSpec-inspired styling and formatting patterns to enhance visual navigation. This includes:
1. Deep-linking permalinks on every `H2` and `H3` header.
2. A visually formatted philosophy block in `philosophy.md`.
3. Two-mode workflow paths (Quick Path vs Expanded Path) in `workflows.md` and `getting-started.md`.
4. Artifact flow diagrams showing data and pipeline transitions.
5. Structured Verification Dimension Reports (Structural, Semantic, Logical, Drift).

#### Scenario: Verification of OpenSpec visual components
- **WHEN** reviewing the Markdown files inside the `docs/` directory
- **THEN** every `H2` and `H3` header is followed by a "Permalink: <header name>" line, core principles in `philosophy.md` are presented in a character-aligned text block, `concepts.md` contains an ASCII flow diagram of the 5 layers, and `workflows.md` contains two distinct user path sections.

### Requirement: Creation of comprehensive troubleshooting and onboarding guides
The documentation suite SHALL include newly created, highly practical onboarding and troubleshooting guides that did not exist in the monolithic `README.md`. Specifically:
1. `docs/getting-started.md` MUST provide a step-by-step 5-minute walk-through from installation to validation.
2. `docs/troubleshooting.md` MUST provide an exit code reference mapping codes 0-10 to symptoms and solutions, alongside a diagnostics example using the doctor subcommand.

#### Scenario: Verification of onboarding and troubleshooting details
- **WHEN** examining `docs/getting-started.md` and `docs/troubleshooting.md`
- **THEN** `docs/getting-started.md` contains an interactive walkthrough block showing expected output, and `docs/troubleshooting.md` maps exit codes 0-10 to cause-and-resolution blocks and contains a `bp doctor` output visualization block.
