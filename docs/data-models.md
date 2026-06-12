# Data Models

Core data types shared across all four engines. Canonical sources are the Zod
schemas in the codebase — file paths are given per model.

---

## `Fingerprint`

Repository detection output from the Detector engine. Canonical schema:
`FingerprintSchema` in `src/detector/fingerprint.ts` (`version: "1.0"`).

| Field | Type | Description |
|-------|------|-------------|
| `version` | `"1.0"` | Schema version |
| `detected_at` | ISO datetime string | When detection ran |
| `project` | object | `name`, `root`, `type` (`monorepo \| polyrepo \| library \| application \| service`), `git_workflow` (`github-flow \| trunk-based \| gitflow \| unknown`) |
| `languages[]` | array | `{ name, confidence (0–1), primary }`; `name` is one of: typescript, javascript, python, go, rust, java, ruby, dart, cpp, csharp, swift, php |
| `frameworks[]` | array | `{ name, confidence (0–1) }` |
| `entry_points[]` | array | `{ path, type: cli \| server \| library \| ui }` |
| `tooling` | object | Optional `package_manager`, `test_runner`, `test_command`, `build_tool`, `linter`, `formatter`, `ci_system` |
| `directory_topology` | object | `src_dirs[]`, `test_dirs[]`, `config_dirs[]`, `package_dirs[]` |
| `security_signals` | object | `has_auth`, `has_external_apis`, `has_secrets_manager`, `has_docker`; optional `has_data_sensitive`, `has_financial_data`, `has_pii`, `has_encryption` |
| `workspacePackages[]` | `string[]` | Monorepo workspace package paths (optional, defaults `[]`) |

**JSON example:**

```json
{
  "version": "1.0",
  "detected_at": "2026-06-12T10:00:00Z",
  "project": {
    "name": "my-express-service",
    "root": "/home/user/my-service",
    "type": "application",
    "git_workflow": "trunk-based"
  },
  "languages": [
    { "name": "typescript", "confidence": 1.0, "primary": true }
  ],
  "frameworks": [{ "name": "express", "confidence": 1.0 }],
  "entry_points": [{ "path": "src/index.ts", "type": "server" }],
  "tooling": {
    "package_manager": "npm",
    "test_runner": "vitest",
    "test_command": "npm run test",
    "linter": "biome",
    "ci_system": "github-actions"
  },
  "directory_topology": {
    "src_dirs": ["src"],
    "test_dirs": ["tests"],
    "config_dirs": ["."],
    "package_dirs": []
  },
  "security_signals": {
    "has_auth": true,
    "has_external_apis": false,
    "has_secrets_manager": false,
    "has_docker": true
  }
}
```

---

## `BlueprintIR`

Neutral intermediate representation shared across adapters. Canonical schema:
`BlueprintIRSchema` in `src/translator/ir.ts` (`version: "2.0"`). Beyond the core
layers below, the schema also defines optional `commands[]`, `mcp_servers[]`,
`identity`, `audit`, and `compliance` sections — see
[Backend Adapters](backend-adapter.md) for the full field listing.

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

Output of a validation run. Canonical source: `ValidationResult` in
`src/validator/index.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `passed` | `boolean` | True if no errors |
| `errors` | `ValidationError[]` | Blocking violations |
| `warnings` | `ValidationError[]` | Non-blocking issues |
| `infos` | `ValidationError[]` | Informational findings (e.g. `RULE_MANUAL`) |
| `level` | `ValidationLevel` | `structural \| semantic \| logical \| enforcement \| drift \| governance \| all` |
| `filesChecked` | `number` | Number of blueprint files examined |
| `enforcement?` | `EnforcementSummary` | `enforced` / `violations` / `manual` counts (enforcement level) |

Each `ValidationError` carries `file`, `type`, `severity` (`error \| warning \| info`),
`message`, `resolution`, and optionally `line`.

**JSON example:**

```json
{
  "passed": false,
  "errors": [
    {
      "file": ".claude/rules/example.md",
      "type": "MISSING_FRONTMATTER",
      "severity": "error",
      "message": "Rule file is missing required frontmatter",
      "resolution": "Add frontmatter with scope, severity, and action fields"
    }
  ],
  "warnings": [],
  "infos": [],
  "level": "structural",
  "filesChecked": 12
}
```

---

## Rule & Skill Packs (`bp-pack/1`)

Packs are single YAML/JSON files (`*.bp-pack.yaml|yml|json`) conforming to the
`bp-pack/1` schema: `schema`, `id`, `name`, `version` (strict semver), `kind`
(`rules` or `skills`), `framework` (`gdpr | soc2 | hipaa | pci-dss | iso-27001 |
custom`), `description`, `author`, `tags`, and either `rules[]` (1–200) or
`skills[]`. The full format reference with examples lives in
[Rule Packs](rule-packs.md) and [Skill Authoring](skill-authoring.md); the install
lockfile (`bp-pack-lock/1`, `.bp/packs.lock.json`) and signed artifact format
(`bp-artifact/1`) are documented in [Pack Distribution](pack-distribution.md).

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
