# ⚙️ Configuration System

Permalink: Configuration System

This document outlines the configuration structure, options, and schemas used by **open-blueprint (`bp`)**.

---

## 🗂️ Configuration Scopes

Permalink: Configuration Scopes

`bp` utilizes two distinct levels of configuration to balance global developer preferences with project-specific rules:

1. [Global User Configuration](#1-global-user-configuration) (`~/.bp/config.json`)
2. [Project Configuration](#2-project-configuration) (`.bp.json`)

---

## 🌐 1. Global User Configuration

Permalink: 1. Global User Configuration

The global configuration defines system-wide defaults across all repository scaffolds. It is stored at `~/.bp/config.json`.

### Global Schema Properties

Permalink: Global Schema Properties

| Key | Type | Description | Default |
|---|---|---|---|
| `default_backend` | `string` | The default agent backend to initialize when not specified. | `"claude"` |
| `template_registry` | `string` | The remote package registry URL for template pack resolution. | `"https://registry.npmjs.org"` |
| `custom_templates` | `array` | Paths to local template folders on the developer machine. | `[]` |
| `auto_verify_on_init` | `boolean` | Instantly trigger `bp verify` upon a successful `bp init`. | `true` |
| `auto_fix_level` | `string` | Severity level of anomalies that `bp` should automatically resolve. | `"structural"` |
| `ci_mode` | `boolean` | Optimizes logging output and sets terminal behaviors for CI environments. | `false` |

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

Permalink: 2. Project Configuration

The project configuration controls how `bp` scaffolds, validates, and translates configurations within a single repository. It must be checked into the source control system as `.bp.json` at the root of the project.

### Project Schema Properties

Permalink: Project Schema Properties

| Key | Type | Description | Required |
|---|---|---|---|
| `backend` | `string` | Target backend for active governance (`claude`, `cursor`, `opendev`, `generic`). | Yes |
| `extends` | `string` | Name of a template pack or internal organization policy base to inherit. | No |
| `overrides` | `object` | Customize or soften validation severities defined in the base template. | No |
| `exclude` | `array` | Glob patterns of directories to completely skip during file verification. | No |
| `plugins` | `array` | Package names or file paths of custom validators to inject into the pipeline. | No |

**Example .bp.json:**

```json
{
  "backend": "claude",
  "extends": "@myorg/blueprint-base",
  "overrides": {
    "rules": {
      "severity_defaults": "soft"
    }
  },
  "exclude": [
    "legacy/",
    "vendor/",
    "dist/"
  ],
  "plugins": [
    "@myorg/bp-validate-rationale"
  ]
}
```

---

## 🏛️ Template Inheritance

Permalink: Template Inheritance

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
| `BP_REGISTRY_PUBLIC_KEY` | *(unset)* | PEM-encoded RSA public key for verifying registry package signatures. Falls back to `~/.bp/keys/*.pub`. When unset, signature verification is skipped with a warning. |
| `BP_MAX_VALIDATION_FILES` | `1000` | Maximum number of blueprint files allowed before validation aborts with `ResourceLimitError`. |
| `BP_MAX_VALIDATION_BYTES` | `52428800` (50 MB) | Maximum total file size in bytes allowed before validation aborts with `ResourceLimitError`. |
| `BP_VALIDATION_TIMEOUT_MS` | `30000` (30 s) | Maximum milliseconds the validation pipeline is allowed to run before aborting with `ValidationTimeoutError`. |
| `BP_LOG_LEVEL` | `info` | Pino log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`). |
