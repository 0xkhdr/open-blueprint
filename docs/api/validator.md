# Validator Engine API

The Validator engine runs a four-layer validation pipeline against a blueprint directory.

## Validation Layers

| Layer | Module | Description |
|-------|--------|-------------|
| **Structural** | `src/validator/structural.ts` | File presence, front-matter schema, required field completeness |
| **Semantic** | `src/validator/semantic.ts` | Rule logic coherence, persona constraint conflicts, tool scope overlaps |
| **Logical** | `src/validator/logical.ts` | Cross-rule dependency ordering, circular reference detection |
| **Drift** | `src/validator/drift.ts` | Hash comparison between blueprint snapshot and current disk state |

## `ValidationResult` Types

```typescript
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
  layer: "structural" | "semantic" | "logical" | "drift" | "all";
  durationMs: number;
}
```

## Exit Code Mappings

| Exit Code | Condition |
|-----------|-----------|
| `0` | All layers passed |
| `4` | Structural validation failure |
| `5` | Semantic validation failure |
| `6` | Drift detected |
| `1` | Unexpected error in validator |

## Drift State Machine

```
              ┌──────────────┐
              │    CLEAN     │  ← initial state after bp init
              └──────┬───────┘
                     │ file modified outside bp
                     ▼
              ┌──────────────┐
              │   DRIFTED    │  ← exit 6
              └──────┬───────┘
                     │ bp sync --auto-apply
                     ▼
              ┌──────────────┐
              │   SYNCED     │  ← snapshot hash updated
              └──────────────┘
```

Drift is detected by comparing SHA-256 hashes of tracked files against the `.bp-lock` snapshot. Any mismatch transitions to DRIFTED state.
