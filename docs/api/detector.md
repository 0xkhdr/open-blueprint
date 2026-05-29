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
import { detectProject } from "./src/detector/index.js";

const fingerprint = await detectProject(process.cwd());
console.log(fingerprint.language);    // "typescript"
console.log(fingerprint.framework);   // "next.js"
console.log(fingerprint.riskTier);    // "medium"
```

### Example 2 — Within `bp doctor`

```typescript
import { detectProject } from "../../detector/index.js";
import { scoreRisk } from "../../detector/cost-scorer.js";

const fp = await detectProject(cwd);
const score = scoreRisk(fp);
// score.tier → "low" | "medium" | "high" | "critical"
// score.signals → string[] of triggered signal names
```
