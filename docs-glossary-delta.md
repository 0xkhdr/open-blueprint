# 📖 Glossary Delta Report

This report outlines new architectural terms and conventions identified during the regression cycle that MUST be canonicalized or added to the primary `docs/glossary.md` reference.

---

## 🆕 Proposed Glossary Additions

### Model Context Protocol (MCP)
* **Definition**: A standard protocol enabling AI models to safely and securely connect to external data sources and tools.
* **Context**: Managed via the `bp mcp` CLI subcommands to audit, inspect, and register MCP servers.

### Agent Registry
* **Definition**: A centralized database or local config tracking known agent signatures, configurations, and environment mappings.
* **Context**: Accessed and managed via the `bp agent` command suite.

### Semantic Drift
* **Definition**: High-level behavioral or statistical deviations in agent outputs, latencies, or token usage, occurring even when physical repository structures remain identical.
* **Context**: Audited via `bp verify --level drift` and `bp doctor` drift parameters.

### Preserve Block
* **Definition**: Custom comment sections (`<!-- bp:preserve -->` ... `<!-- bp:end-preserve -->`) that designate manual developer guidelines that the Templater Engine must not overwrite.
* **Context**: Used to maintain custom team guidelines across automated scaffolding syncs.

### Blueprint Marketplace
* **Definition**: A public or private organizational repository where signed blueprint templates are published and shared.
* **Context**: Accessed via `bp marketplace` subcommands.
