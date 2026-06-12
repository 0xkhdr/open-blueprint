# Validator Engine API

The Validator engine (`src/validator/index.ts`) runs a blueprint directory through
six validation levels.

## Validation Levels

| Level | Module(s) | Description |
|-------|-----------|-------------|
| **Structural** | `src/validator/structural.ts` | Frontmatter schema, markdown structure, encoding, file size |
| **Semantic** | `src/validator/semantic.ts`, `src/validator/skills.ts` | Scope glob resolution, tool references, skill validation |
| **Logical** | `src/validator/logical.ts` | Circular skill dependencies (Tarjan SCC), rule scope overlap/contradictions, precedence |
| **Enforcement** | `src/validator/enforcement.ts`, `src/validator/checks/` | Declarative rule `check` evaluation (static reads only) |
| **Drift** | `src/validator/drift.ts`, `src/validator/pack-integrity.ts` | Fingerprint delta vs `.bp-fingerprint.json`; pack integrity vs `.bp/packs.lock.json` |
| **Governance** | `src/validator/orchestration.ts`, `src/validator/cross-layer.ts`, … | Agents, MCP servers, teams, chain DAGs, memory, cross-layer consistency |

Plugin validators from `.bp.json` run after the built-in checks for their declared
level (see [Plugin API](../plugin-api.md)).

## Types

```typescript
type ValidationLevel =
  | "structural" | "semantic" | "logical"
  | "enforcement" | "drift" | "governance" | "all";

type ValidationSeverity = "error" | "warning" | "info";

interface ValidationError {
  file: string;
  type: string;
  severity: ValidationSeverity;
  message: string;
  resolution: string;
  line?: number;
}

interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  level: ValidationLevel;
  filesChecked: number;
  enforcement?: { enforced: number; violations: number; manual: number };
}
```

## Resource Limits

Validation aborts (fail-loud) when limits are exceeded — all overridable by
environment variable:

| Limit | Default | Env var |
|---|---|---|
| Max blueprint files | 1000 | `BP_MAX_VALIDATION_FILES` |
| Max total bytes | 50 MB | `BP_MAX_VALIDATION_BYTES` |
| Pipeline timeout | 30 s | `BP_VALIDATION_TIMEOUT_MS` |

## Exit Code Mapping

| Exit Code | Condition |
|-----------|-----------|
| `0` | All requested levels passed |
| `4` | Structural validation failure |
| `5` | Semantic/logical validation failure |
| `6` | Drift detected — only when explicitly requested via `--level drift` or `--fail-on drift`; otherwise drift findings are advisory warnings |
| `1` | Unexpected error in validator |

## Drift Detection

Drift compares SHA-256 hashes of tracked files against the fingerprint snapshot
`.bp-fingerprint.json` (written by `bp init`, refreshed by `bp sync`):

```text
CLEAN (after bp init) ──file modified outside bp──► DRIFTED ──bp sync --auto-apply──► SYNCED
```

Pack-managed files are additionally cross-checked against `.bp/packs.lock.json`
(`PACK_FILE_MODIFIED` / `PACK_FILE_MISSING` / aggregate `PACK_DRIFTED`).
