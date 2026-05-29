# 🔌 Plugin / Extension API

Permalink: Plugin / Extension API

This document provides documentation and guidelines for extending **open-blueprint (`bp`)** using custom validators and lifecycle plugins.

---

## 🎨 Plugin Architecture & Lifecycle

Permalink: Plugin Architecture & Lifecycle

`bp` plugins are loaded dynamically during execution and integrate directly into the Validator Engine pipeline:

```text
[CLI Command] ➔ [Load .bp.json] ➔ [Instantiate Plugins] ➔ [Run Structural Checks] ➔ [Plugin Hook: semantic] ➔ [Logical Validation]
```

---

## 💻 Writing a Custom Validator

Permalink: Writing a Custom Validator

`bp` features a stable TypeScript Plugin API. You can write custom validators to enforce internal governance checks, such as requiring rationale fields for `hard` rules:

```typescript
import { definePlugin, ValidationContext } from "@agentic/bp/plugin";

export default definePlugin({
  name: "company-security-validator",
  version: "1.0.0",
  validators: [{
    id: "require-rationale-on-hard-rules",
    level: "semantic",
    check: (ctx: ValidationContext) => {
      for (const rule of ctx.blueprint.rules) {
        if (rule.frontmatter.severity === "hard" && !rule.frontmatter.rationale) {
          ctx.error(
            rule.file,
            rule.line,
            "Hard constraints must declare a valid rationale",
            "Add: rationale: 'Why this constraint exists'"
          );
        }
      }
    }
  }]
});
```

---

## ⚙️ Registration & Deployment

Permalink: Registration & Deployment

To enable a plugin in your repository:

1. **Package Installation**: Publish your plugin to a private npm registry or store it locally in the project (e.g., `./plugins/custom-validator.ts`).
2. **Project Setup (`.bp.json`)**: List the plugin package name or relative file path in the `plugins` configuration block:

```json
{
  "backend": "claude",
  "plugins": [
    "./plugins/custom-validator.ts"
  ]
}
```

1. **Execution**: The next time `bp verify` is run, the engine will compile (using standard dynamic TS loaders) and execute your custom validation hooks.
