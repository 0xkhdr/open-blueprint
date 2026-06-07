# Detector Engine API

The Detector engine fingerprints a repository and returns a `Fingerprint` object describing its technology stack, framework topology, and risk signals.

## `Fingerprint` Zod Schema

```typescript
import { z } from "zod";

const FingerprintSchema = z.object({
  language: z.string(),                    // primary language: "typescript" | "python" | "go" | ...
  framework: z.string().optional(),        // detected framework: "next.js" | "express" | "fastapi" | ...
  runtime: z.string().optional(),          // runtime: "node" | "bun" | "deno" | "python" | ...
  hasTests: z.boolean(),
  hasCICD: z.boolean(),
  hasDocker: z.boolean(),
  hasMonorepo: z.boolean(),
  riskTier: z.enum(["low", "medium", "high", "critical"]).optional(),
  tooling: z.array(z.string()),            // detected tools: ["eslint", "prettier", ...]
  projectRoot: z.string(),
  detectedBackends: z.array(z.string()),   // found bp backends: ["claude", "cursor", ...]
});

type Fingerprint = z.infer<typeof FingerprintSchema>;
```

## Detection Algorithm Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `projectRoot` | `process.cwd()` or `--dir` arg | Absolute path to scan |
| `maxDepth` | hardcoded `3` | Directory traversal depth limit |
| File patterns | `src/detector/frameworks.ts` | Glob patterns per framework |
| Language markers | `src/detector/languages.ts` | File extensions and config files |
| Security signals | `src/detector/security.ts` | Presence of auth, secrets, external API patterns |

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
