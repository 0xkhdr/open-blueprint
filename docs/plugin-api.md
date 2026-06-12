# 🔌 Plugin / Extension API

This document explains how to extend **open-blueprint (`bp`)** with custom validator plugins that run inside the `bp verify` pipeline.

---

## 🎨 Plugin Architecture & Lifecycle

Plugins are configured in `.bp.json` and executed by the Validator Engine after the built-in checks for the requested level:

```text
[CLI Command] ➔ [Load .bp.json] ➔ [Built-in Checks] ➔ [Build Plugin Context] ➔ [Run Plugin Validators] ➔ [Merge Diagnostics]
```

Each plugin declares one or more **validators**, and each validator targets one of four levels: `structural`, `semantic`, `logical`, or `enforcement`. When `bp verify --level semantic` runs, plugin validators registered for `structural` and `semantic` execute; `--level all` runs every level. Plugin diagnostics are merged into the normal verify output with the type `PLUGIN_<NAME>_<ID>` (for example `PLUGIN_COMPANY_CHECKS_REQUIRE_RATIONALE`).

A misbehaving plugin never takes down the run: a crash inside a validator is reported as a single `PLUGIN_CRASHED` error, a timeout as `PLUGIN_TIMEOUT`, and a broken module as `PLUGIN_LOAD_ERROR` — all other plugins still run and report.

---

## 💻 Writing a Custom Validator

The public API lives at the `@agentic/bp/plugin` subpath export. The fastest start is the scaffolder:

```bash
bp dev plugin:scaffold company-checks
bp dev plugin:test ./plugins/company-checks.mjs
```

A plugin module default-exports the result of `definePlugin`:

```typescript
import { definePlugin, type ValidationContext } from "@agentic/bp/plugin";

export default definePlugin({
  name: "company-checks",
  version: "1.0.0",
  validators: [
    {
      id: "require-rationale-on-hard-rules",
      level: "semantic",
      check(ctx: ValidationContext) {
        for (const file of ctx.files) {
          if (file.layer === "rules" && file.frontmatter.severity === "hard" && !file.frontmatter.rationale) {
            ctx.error(
              file.path,
              file.lineOf("severity"),
              "Hard rules must declare a rationale",
              'Add: rationale: "why this constraint exists"'
            );
          }
        }
      },
    },
  ],
});
```

### ValidationContext

| Member | Description |
|---|---|
| `ctx.blueprint` | The parsed blueprint IR (rules, skills, hooks, personas, meta). Read-only (deeply frozen). |
| `ctx.fingerprint` | The project fingerprint from detection, when available. Read-only. |
| `ctx.files` | Inventory of blueprint files: `{ path, layer, frontmatter, body, lineOf(field) }`. `layer` is one of `anchor \| rules \| skills \| agents \| hooks \| unknown`. `lineOf("severity")` returns the 1-based line of a top-level frontmatter key for precise diagnostics. |
| `ctx.error(file, line, message, resolution)` | Report an error (fails verify). `line` may be `undefined`. |
| `ctx.warn(file, line, message, resolution?)` | Report a warning. |
| `ctx.info(file, message)` | Report informational output. |

All context data is deeply frozen — validators cannot mutate the blueprint or file inventory.

---

## ⚙️ Registration & Configuration

List plugins in the `plugins` array of `.bp.json`. Paths must resolve **inside the project root** (paths escaping the root are rejected with `PLUGIN_PATH_ESCAPE`):

```json
{
  "backends": ["claude"],
  "plugins": [
    "./plugins/company-checks.mjs",
    { "path": "./plugins/fast-check.mjs", "mode": "inline" }
  ]
}
```

A bare string is shorthand for `{ "path": "...", "mode": "isolated" }`.

### Execution modes

| Mode | How it runs | Use when |
|---|---|---|
| `isolated` (default) | In a worker thread with a hard wall-clock timeout (`BP_PLUGIN_TIMEOUT_MS`, default `10000` ms) and a 256 MB heap cap. Runaway loops are terminated; runaway allocation is killed by the resource limit. | Always, unless you need maximum speed for a trusted local plugin. |
| `inline` | Directly in the `bp` process via dynamic `import`. No timeout or memory cap. | Tight inner-loop development of your own plugin (`bp dev plugin:test --mode inline`). |

Skip all plugins for a run with `bp verify --no-plugins`.

---

## 🔐 Trust Model

**Plugins run with your user's privileges. Only run plugins you trust.**

Isolated mode is a *resource* boundary, not a *security* boundary: worker threads cap runtime and memory and keep plugin state out of the validator process, but a plugin can still read and write files, open network connections, and do anything else your user account can do. Treat adding a plugin to `.bp.json` exactly like adding a dependency to `package.json` — review the code or its source first.

For team-wide rollout, distribute plugins as signed artifacts and install them with `bp pack plugin:install` — see [Pack Distribution](pack-distribution.md).
