# Detector Engine API

The Detector engine fingerprints a repository and returns a `Fingerprint` object describing its technology stack, framework topology, and risk signals.

## `Fingerprint` Zod Schema

Canonical source: `FingerprintSchema` in `src/detector/fingerprint.ts`
(`version: "1.0"`) — abridged:

```typescript
const FingerprintSchema = z.object({
  version: z.literal("1.0"),
  detected_at: z.string().datetime(),
  project: z.object({
    name: z.string(),
    root: z.string(),
    type: z.enum(["monorepo", "polyrepo", "library", "application", "service"]),
    git_workflow: z.enum(["github-flow", "trunk-based", "gitflow", "unknown"]),
  }),
  languages: z.array(z.object({
    name: LanguageNameSchema,          // typescript | javascript | python | go | rust | ...
    confidence: z.number().min(0).max(1),
    primary: z.boolean(),
  })),
  frameworks: z.array(z.object({ name: z.string(), confidence: z.number() })),
  entry_points: z.array(z.object({
    path: z.string(),
    type: z.enum(["cli", "server", "library", "ui"]),
  })),
  tooling: z.object({ /* package_manager, test_runner, test_command, build_tool,
                         linter, formatter, ci_system — all optional */ }),
  directory_topology: z.object({ /* src_dirs, test_dirs, config_dirs, package_dirs */ }),
  security_signals: z.object({ /* has_auth, has_external_apis, has_secrets_manager,
                                  has_docker, + optional pii/financial/encryption */ }),
  workspacePackages: z.array(z.string()).optional().default([]),
});

type Fingerprint = z.infer<typeof FingerprintSchema>;
```

See [Data Models](../data-models.md#fingerprint) for the full field table.

## Detection Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `projectRoot` | caller-supplied path | Absolute path to scan |
| Framework patterns | `src/detector/frameworks.ts` | Manifest/dependency markers per framework |
| Language markers | `src/detector/languages.ts` | File extensions and config files |
| Tooling markers | `src/detector/tooling.ts` | Lockfiles, linter/formatter/CI configs |
| Security signals | `src/detector/security.ts` | Presence of auth, secrets manager, Docker, external API patterns |
| Enterprise signals | `src/detector/enterprise-signals.ts` | RBAC / audit / DLP indicators |
| Workspace layout | `src/detector/workspace-parser.ts` | Monorepo workspace packages |

Detection is pure static analysis: no network calls, no build-tool invocation,
no shell commands.

## Usage Examples

### Example 1 — Programmatic detection

```typescript
import { detect } from "./src/detector/index.js";

const fingerprint = await detect(process.cwd());
console.log(fingerprint.languages);    // [{ name: "typescript", primary: true, ... }]
console.log(fingerprint.frameworks);   // [{ name: "nextjs", confidence: 0.95, ... }]
```

### Example 2 — Enriching a fingerprint with risk signals

```typescript
import { detect, enrichFingerprint } from "../../detector/index.js";

const fp = await detect(cwd);
const enriched = enrichFingerprint(fp);
// enriched.risk_tier              → "low" | "medium" | "high" | "critical"
// enriched.suggested_approval_mode → "auto" | "confirm" | "read-only"
// enriched.enterprise_signals      → detected RBAC / audit / DLP signals
```
