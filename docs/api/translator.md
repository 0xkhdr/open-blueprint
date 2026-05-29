# Translator Engine API

The Translator engine converts blueprint governance configurations between backend formats using `BlueprintIR` as the neutral intermediate representation.

## `BlueprintIR` Schema (abbreviated)

```typescript
interface BlueprintIR {
  version: "2.0";
  spatial_anchor: {
    project_name: string;
    surface: string;          // raw anchor file content
    temporal_anchor: string;  // ISO timestamp
    conventions: string[];
  };
  personas: Persona[];
  rules: Rule[];
  skills: Skill[];
  hooks: Hook[];
  settings?: Settings;
  meta: {
    rule_precedence: string[];
    conflict_resolution: string;
    source_backend: string;
    target_backend: string;
  };
}
```

See `src/translator/ir.ts` for the complete Zod schema with all optional enterprise layers.

## Adapter Identifiers

| Identifier | Class | Anchor File |
|------------|-------|-------------|
| `claude` | `ClaudeAdapter` | `CLAUDE.md` |
| `cursor` | `CursorAdapter` | `.cursorrules` |
| `codex` | `CodexAdapter` | `CODEX.md` |
| `pi` | `PIAdapter` | `PI.md` |
| `opendev` | `OpenDevAdapter` | `opendev.yaml` |
| `generic` | `GenericAdapter` | `BLUEPRINT.md` |
| `copilot` | `CopilotAdapter` | `.github/copilot-instructions.md` |
| `gemini` | `GeminiAdapter` | `GEMINI.md` |
| `memory` | `MemoryAdapter` | `.bp/memory/` |

## Round-Trip Conversion Example

```typescript
import { ClaudeAdapter } from "./adapters/claude.js";
import { CursorAdapter } from "./adapters/cursor.js";

// Parse Claude format → IR
const claudeAdapter = new ClaudeAdapter();
const ir = await claudeAdapter.parse("/project");

// Mutate target backend in meta
ir.meta.target_backend = "cursor";

// Render IR → Cursor format
const cursorAdapter = new CursorAdapter();
const writtenFiles = await cursorAdapter.render(ir, "/project");

// writtenFiles: [".cursorrules", "AGENTS.md", ...]
```

A round-trip is semantically lossless for fields present in both formats. Fields not supported by the target adapter are preserved in IR but not written to disk.
