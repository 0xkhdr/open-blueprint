# ⚙️ Configuration System

This document outlines the configuration structure, options, and schemas used by **open-blueprint (`bp`)**.

---

## 🗂️ Configuration Scopes

`bp` utilizes two distinct levels of configuration to balance global developer preferences with project-specific rules:

1. [Global User Configuration](#1-global-user-configuration) (`~/.bp/config.json`)
2. [Project Configuration](#2-project-configuration) (`.bp.json`)

---

## 🌐 1. Global User Configuration

The global configuration defines system-wide defaults across all repository scaffolds. It is stored at `~/.bp/config.json`.

### Global Schema Properties

| Key | Type | Description | Default |
|---|---|---|---|
| `default_backend` | `string` | The default agent backend to initialize when not specified. | `"claude"` |
| `template_registry` | `string` | The remote package registry URL for template pack resolution. | `"https://registry.npmjs.org"` |
| `custom_templates` | `array` | Paths to local template folders on the developer machine. | `[]` |
| `auto_verify_on_init` | `boolean` | Instantly trigger `bp verify` upon a successful `bp init`. | `true` |
| `auto_fix_level` | `string` | Severity level of anomalies that `bp` should automatically resolve. | `"structural"` |
| `ci_mode` | `boolean` | Optimizes logging output and sets terminal behaviors for CI environments. | `false` |
| `codex_home` | `string` | Overrides `$CODEX_HOME` for the `codex` backend's global command path. | *(unset)* |
| `registry_url` | `string` | Signed static-host pack registry index URL (Stage 5). Set via `bp config set registry.url <url>` — the dotted form is an alias for this key. See [pack-distribution.md](pack-distribution.md). | *(unset)* |

Canonical schema: `UserConfigSchema` in `src/config/user.ts`. `auto_fix_level`
accepts `structural | semantic | logical`.

**Example config.json:**

```json
{
  "default_backend": "claude",
  "template_registry": "https://registry.npmjs.org",
  "custom_templates": [],
  "auto_verify_on_init": true,
  "auto_fix_level": "structural",
  "ci_mode": false
}
```

---

## 📁 2. Project Configuration

The project configuration controls how `bp` scaffolds, validates, and translates configurations within a single repository. It must be checked into the source control system as `.bp.json` at the root of the project.

### Project Schema Properties

Canonical schema: `ProjectConfigSchema` in `src/config/project.ts`. The current
(v2) schema uses a `backends` array; the legacy v1 single `backend` string is
still accepted and normalized to `backends: [backend]` + `primary_backend`.
Upgrade in place with `bp migrate config`.

| Key | Type | Description | Required |
|---|---|---|---|
| `backends` | `string[]` | Backend IDs under active governance (see [Supported Tools](supported-tools.md)). | Yes (or legacy `backend`) |
| `primary_backend` | `string` | Which configured backend `bp` treats as primary; must be in `backends`. | No (defaults to first) |
| `backend` | `string` | **Legacy v1**: single backend; normalized to the v2 fields on load. | — |
| `backend_configs` | `object` | Per-backend overrides: `delivery_mode` (`skills_and_commands \| skills_only \| commands_only`) and `workflows` (string array). | No |
| `extends` | `string` | Template pack or organization policy base to inherit. | No |
| `overrides` | `object` | Validation severity overrides, e.g. `{ "rules": { "severity_defaults": "hard \| soft \| info" } }`. | No |
| `exclude` | `string[]` | Glob patterns to skip during verification (default `[]`). | No |
| `plugins` | `array` | Validator plugins for `bp verify`: a path string (runs `isolated`) or `{ "path", "mode": "isolated" \| "inline" }`. Paths must stay inside the project root. See [Plugin API](plugin-api.md). | No |
| `scan` | `object` | `{ "entropyEnabled": true }` enables entropy-based secret detection (same as `bp verify --entropy-scan`). | No |

**Example .bp.json:**

```json
{
  "backends": ["claude", "cursor"],
  "primary_backend": "claude",
  "backend_configs": {
    "cursor": { "delivery_mode": "skills_only" }
  },
  "extends": "@myorg/blueprint-base",
  "overrides": {
    "rules": { "severity_defaults": "soft" }
  },
  "exclude": ["legacy/", "vendor/", "dist/"],
  "plugins": [
    "./plugins/validate-rationale.mjs",
    { "path": "./plugins/fast-check.mjs", "mode": "inline" }
  ],
  "scan": { "entropyEnabled": false }
}
```

---

## 🏛️ Template Inheritance

When utilizing the `extends` property in `.bp.json`:

1. **Dependency Resolution**: `bp` will query the defined `template_registry` to download and cache the base package.
2. **Structural Composition**: Files from the base package are loaded.
3. **Local Overriding**:
   * If a file exists in the local repository topology (e.g. `.claude/rules/02-security.md`), it takes precedence over the template-derived rule.
   * Property overrides inside `.bp.json` will adjust validation rules. For example, setting `"severity_defaults": "soft"` will treat a template's `hard` constraints as optional warning signals rather than strict blocker exceptions.

---

## 🔐 Environment Variables

The following environment variables control security, validation limits, and observability:

| Variable | Default | Description |
|---|---|---|
| `BP_AUDIT_HMAC_KEY` | *(unset)* | HMAC-SHA256 key for audit log signing. When unset, entries are written with `sig: null` and a warning is emitted. |
| `BP_REGISTRY_PUBLIC_KEY` | *(unset)* | Legacy PEM-encoded RSA public key for verifying signed pack artifacts; folded into the Stage 5 trust keyring as `env:BP_REGISTRY_PUBLIC_KEY`. Prefer `bp trust add`. |
| `BP_PACK_MAX_BYTES` | `10485760` (10 MiB) | Maximum pack artifact size — applies to both the network download and the decompressed archive contents. |
| `BP_PACK_TIMEOUT_MS` | `30000` (30 s) | Timeout for pack artifact and registry index downloads. |
| `BP_OFFLINE` | *(unset)* | Set to `1` to skip the advisory registry-index lookup (`PACK_OUTDATED`) during `bp verify`. |
| `BP_HOME` | `~/.bp` | Overrides the bp home directory (user config, trust store, signing keys). |
| `BP_MAX_VALIDATION_FILES` | `1000` | Maximum number of blueprint files allowed before validation aborts with `ResourceLimitError`. |
| `BP_MAX_VALIDATION_BYTES` | `52428800` (50 MB) | Maximum total file size in bytes allowed before validation aborts with `ResourceLimitError`. |
| `BP_VALIDATION_TIMEOUT_MS` | `30000` (30 s) | Maximum milliseconds the validation pipeline is allowed to run before aborting with `ValidationTimeoutError`. |
| `BP_LOG_LEVEL` | `info` | Pino log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`). |
