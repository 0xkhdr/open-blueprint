# Data Models

Core data types shared across all four engines.

---

## `Fingerprint`

Repository detection output from the Detector engine.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `language` | `string` | Yes | Primary language (`"typescript"`, `"python"`, `"go"`) |
| `framework` | `string` | No | Detected framework (`"next.js"`, `"express"`, `"fastapi"`) |
| `runtime` | `string` | No | Runtime environment (`"node"`, `"bun"`, `"python"`) |
| `hasTests` | `boolean` | Yes | Test files detected |
| `hasCICD` | `boolean` | Yes | CI/CD config detected |
| `hasDocker` | `boolean` | Yes | Dockerfile detected |
| `hasMonorepo` | `boolean` | Yes | Monorepo markers detected |
| `riskTier` | `"low" \| "medium" \| "high" \| "critical"` | No | Calculated risk classification |
| `tooling` | `string[]` | Yes | Detected dev tools |
| `projectRoot` | `string` | Yes | Absolute scan root |
| `detectedBackends` | `string[]` | Yes | Existing bp backend directories |

**JSON example:**

```json
{
  "language": "typescript",
  "framework": "next.js",
  "runtime": "node",
  "hasTests": true,
  "hasCICD": true,
  "hasDocker": false,
  "hasMonorepo": false,
  "riskTier": "medium",
  "tooling": ["eslint", "prettier", "vitest"],
  "projectRoot": "/home/user/myapp",
  "detectedBackends": ["claude"]
}
```

---

## `BlueprintIR`

Neutral intermediate representation shared across adapters.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `"2.0"` | Yes | IR schema version |
| `spatial_anchor` | `SpatialAnchor` | Yes | Project identity and conventions |
| `personas` | `Persona[]` | Yes | Agent persona definitions |
| `rules` | `Rule[]` | Yes | Governance rules |
| `skills` | `Skill[]` | Yes | Agent skill definitions |
| `hooks` | `Hook[]` | Yes | Pre/post tool use hooks |
| `settings` | `Settings` | No | Approval mode, model config, cost controls |
| `meta` | `Meta` | Yes | Source/target backend, conflict resolution |

**JSON example:**

```json
{
  "version": "2.0",
  "spatial_anchor": {
    "project_name": "my-api",
    "surface": "# my-api\n\nProject conventions...",
    "temporal_anchor": "2024-01-15T10:00:00.000Z",
    "conventions": ["Use snake_case for file names"]
  },
  "personas": [
    {
      "name": "engineer",
      "role": "Backend developer",
      "reasoning_style": "methodical",
      "constraints": ["No direct DB writes without migration"]
    }
  ],
  "rules": [
    {
      "id": "no-console",
      "scope": "src/**",
      "severity": "hard",
      "action": "Replace console.log with logger",
      "rationale": "Structured logging required"
    }
  ],
  "skills": [],
  "hooks": [],
  "meta": {
    "rule_precedence": ["no-console"],
    "conflict_resolution": "precedence-based",
    "source_backend": "claude",
    "target_backend": "cursor"
  }
}
```

---

## `ValidationResult`

Output from a single validation layer run.

| Field | Type | Description |
|-------|------|-------------|
| `passed` | `boolean` | True if no errors |
| `errors` | `ValidationError[]` | Blocking violations |
| `warnings` | `ValidationError[]` | Non-blocking issues |
| `layer` | `string` | Layer name: `structural`, `semantic`, `logical`, `drift`, `all` |
| `durationMs` | `number` | Layer execution time |

**JSON example:**

```json
{
  "passed": false,
  "errors": [
    {
      "file": "CLAUDE.md",
      "type": "MISSING_REQUIRED_SECTION",
      "severity": "error",
      "message": "Required ## Rules section missing",
      "resolution": "Add a '## Rules' section with at least one rule entry"
    }
  ],
  "warnings": [],
  "layer": "structural",
  "durationMs": 42
}
```

---

## `RulePack`

A named, versioned collection of governance rules distributed via the marketplace.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Pack identifier (`"security-baseline"`) |
| `version` | `string` | Yes | Semver version string |
| `description` | `string` | Yes | Human-readable description |
| `author` | `string` | No | Publisher name |
| `rules` | `Rule[]` | Yes | Rules included in this pack |
| `tags` | `string[]` | No | Searchable tags |
| `verified` | `boolean` | No | Publisher-verified status |

**JSON example:**

```json
{
  "name": "owasp-baseline",
  "version": "1.2.0",
  "description": "OWASP Top 10 governance rules for agentic AI tools",
  "author": "open-blueprint",
  "rules": [
    {
      "id": "no-path-traversal",
      "scope": "**",
      "severity": "hard",
      "action": "Reject path inputs containing '..' segments"
    }
  ],
  "tags": ["security", "owasp"],
  "verified": true
}
```
