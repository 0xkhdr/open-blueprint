# open-blueprint Documentation

Documentation for **open-blueprint (`bp`)**, organized by what you're trying to do.
Everything here is kept in sync with the code; when a doc and `bp <cmd> --help`
disagree, the CLI is authoritative and the doc has a bug — please file an issue.

## Start here

| Doc | What it covers |
|---|---|
| [Getting Started](getting-started.md) | Install, scaffold, verify — plus Docker usage |
| [Core Philosophy](philosophy.md) | The five design pillars and why they exist |
| [Concepts & Architecture](concepts.md) | 5 governance layers, 4 engines, 6 validation levels |
| [Workflows](workflows.md) | Solo, team, and CI workflow patterns |
| [Recipes](recipes.md) | Copy-paste setups and GitHub Actions YAML |

## Reference

| Doc | What it covers |
|---|---|
| [CLI Reference](commands.md) | Every command, subcommand, and flag |
| [Configuration](configuration.md) | `.bp.json`, `~/.bp/config.json`, environment variables |
| [Supported Tools](supported-tools.md) | All 31 backends: paths, syntax, limitations |
| [Data Models](data-models.md) | `Fingerprint`, `BlueprintIR`, `Check`, pack schemas |
| [JSON Output](json-output.md) | Machine-readable output shapes per command |
| [Exit Codes & Troubleshooting](troubleshooting.md) | Exit codes 0–10 (stable API) and diagnostics |
| [Glossary](glossary.md) | Term dictionary |
| [Non-Functional Requirements](nfrs.md) | Latency budgets, reliability targets, OWASP controls |

## Governance content: authoring & sharing

| Doc | What it covers |
|---|---|
| [Rule Packs](rule-packs.md) | Author, lint, install, remove rule packs (`bp-pack/1`) |
| [Skill Authoring](skill-authoring.md) | Canonical skill format, validation, skill packs |
| [Template Authoring](template-authoring.md) | Handlebars template packs and merge markers |
| [Pack Distribution](pack-distribution.md) | Signed artifacts, trust keyring, static-host registry |
| [Governance Reporting](governance-reporting.md) | `bp report`, SARIF, measured vs declared coverage |

## Extending bp

| Doc | What it covers |
|---|---|
| [Plugin API](plugin-api.md) | Custom validators via `@agentic/bp/plugin` |
| [Backend Adapters](backend-adapter.md) | Adding support for a new agent platform |
| [Backend Parity Matrix](backend-parity.md) | Which IR layers each backend reads/writes |
| [Detector API](api/detector.md) · [Templater API](api/templater.md) · [Validator API](api/validator.md) · [Translator API](api/translator.md) | Engine-level programmatic interfaces |

## Operations

| Doc | What it covers |
|---|---|
| [CI/CD Integration](ci-integration.md) | GitHub Actions, GitLab CI, Azure DevOps gates |
| [Observability & Cost](observability.md) | Telemetry config, budgets, behavioral drift |

## Project & contributing

| Doc | What it covers |
|---|---|
| [Contributing](contributing.md) | Dev setup, tests, build, conventions |
| [Documentation Style Guide](style-guide.md) | Authoring standards for these docs |
| [Production Audit](production-audit.md) | The honesty audit: what was removed and why |
| [ADRs](adr/) | ADR-001 TypeScript · 002 Vitest · 003 Pino · 004 Commander · 005 Zod · 006 Handlebars |
| [AGENTS.md](../AGENTS.md) | Guide for AI agents and contributors working on this codebase |
