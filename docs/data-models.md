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

---

## `Check`

A declarative, machine-evaluable rule condition (Stage 1 enforcement). Attached to a
rule via the optional `check` frontmatter field; evaluated by `bp verify --level
enforcement` and `bp rule test`. Checks are pure static reads of the repository and
the Fingerprint — no network, no shell, no code execution.

Rules without a `check` are reported as **manual** (`RULE_MANUAL`, info) — bp never
silently counts them as passing. Rules may also set `enforcement: manual` explicitly.

Limits: regexes ≤ 256 chars and rejected if they contain quantified groups with inner
quantifiers (star-height guard); globs ≤ 256 chars with no `****`; composite trees are
capped at depth 3 and 16 children per composite.

| Type | Semantics |
|------|-----------|
| `file-exists` | ≥ 1 file matches `glob` |
| `file-absent` | 0 files match `glob` |
| `content-match` | Files matching `glob` contain ≥ `minMatches` (default 1) regex matches; `scope: every` (default) requires all files, `any` requires at least one |
| `content-absent` | No file matching `glob` contains the regex |
| `frontmatter-field` | YAML frontmatter `field` in every matching file satisfies `expect` (`exists` / `equals` / `oneOf`) |
| `dependency-present` | Dependency declared in `package.json` (any section); optional `range` is an exact range-string comparison. Other ecosystems degrade to manual |
| `dependency-absent` | Dependency not declared in `package.json` |
| `fingerprint` | Dotted path into the Fingerprint satisfies `expect` (`equals` / `truthy`) |
| `json-key` | Dotted path into a JSON file satisfies `expect` (`exists` / `equals`) |
| `allOf` / `anyOf` / `not` | Boolean composition (short-circuiting) |

**One example per type (YAML frontmatter form):**

```yaml
# file-exists — a security policy must be present
check: { type: file-exists, glob: "SECURITY.md" }

# file-absent — no private keys committed
check: { type: file-absent, glob: "**/*.pem" }

# content-match — some source file initializes an audit logger
check: { type: content-match, glob: "src/**/*.{ts,js}", pattern: "audit[-_]?log", flags: i, scope: any }

# content-absent — no plaintext http:// endpoints
check: { type: content-absent, glob: "src/**/*.ts", pattern: "[\"'`]http://(?!localhost)" }

# frontmatter-field — every rule file declares a valid severity
check:
  type: frontmatter-field
  glob: ".claude/rules/*.md"
  field: severity
  expect: { oneOf: [hard, soft] }

# dependency-present — a structured logger is declared
check: { type: dependency-present, name: pino }

# dependency-absent — a banned package is not declared
check: { type: dependency-absent, name: left-pad }

# fingerprint — the project ships a Dockerfile
check: { type: fingerprint, path: security_signals.has_docker, expect: { truthy: true } }

# json-key — strict TypeScript is enabled
check: { type: json-key, file: tsconfig.json, path: compilerOptions.strict, expect: { equals: true } }

# composites — boolean combinations, max depth 3
check:
  type: allOf
  checks:
    - { type: file-exists, glob: "SECURITY.md" }
    - type: anyOf
      checks:
        - { type: dependency-present, name: pino }
        - { type: dependency-present, name: winston }
```

**`CheckOutcome`** (returned by the evaluator): `passed: boolean`, `detail: string`
(human explanation, e.g. `0 files matched glob 'src/**/audit*.ts'`), and up to 10
`evidence` entries (`{ file, line? }`). Files larger than 1 MiB are skipped from
content scans and noted in `detail`.
