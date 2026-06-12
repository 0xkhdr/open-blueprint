# Templater Engine API

The Templater engine (`src/templater/`) renders logic-less Handlebars templates
from template packs into governance files, with block-level merge so developer
edits survive re-runs.

## Template Context

Canonical source: `TemplateContext` in `src/templater/index.ts`. Built from the
detector `Fingerprint`:

```typescript
interface TemplateContext {
  project_name: string;
  project_type: string;          // monorepo | polyrepo | library | application | service
  primary_language: string;
  primary_framework: string;
  entry_point_path: string;
  test_command: string;
  test_runner: string;
  package_manager: string;
  build_tool: string;
  linter: string;
  ci_system: string;
  git_workflow: string;
  has_auth: boolean;
  has_external_apis: boolean;
  has_docker: boolean;
  languages: Array<{ name: string; confidence: number; primary: boolean }>;
  frameworks: Array<{ name: string; confidence: number }>;
  detected_at: string;
  src_dirs: string[];
  test_dirs: string[];
  // optional risk/enterprise context
  has_secrets_manager?: boolean;
  risk_tier?: "low" | "medium" | "high" | "critical";
  approval_mode?: "auto" | "confirm" | "read-only";
  estimated_monthly_tokens?: number;
}
```

## Handlebars Helper Catalogue

Only an allowlisted helper set is registered (`ALLOWED_HELPERS` in
`src/templater/engine.ts`); templates are otherwise logic-less and cannot execute
code.

| Helper | Example | Description |
|--------|---------|-------------|
| `upper` / `lower` / `capitalize` | `{{upper linter}}` | String casing |
| `kebab` / `snake` | `{{kebab project_name}}` | Case conversion |
| `eq` / `ne` | `{{#if (eq primary_language "go")}}` | (In)equality |
| `includes` | `{{#if (includes src_dirs "lib")}}` | Array membership |
| `join` | `{{join test_dirs ", "}}` | Join array with separator |
| `scopeGlob` | `{{scopeGlob src_dirs}}` | Build a scope glob from a dir list |
| `default` | `{{default build_tool "none"}}` | Fallback value |
| `year` / `date` | `{{year}}` | Current year / ISO date |
| `hasFeature` | `{{#if (hasFeature "docker")}}` | Fingerprint feature test (`docker`, `monorepo`, `cicd`, …) |
| `riskGte` | `{{#if (riskGte "medium")}}` | True when `risk_tier` ≥ given tier |

Compiled templates are LRU-cached (`BP_TEMPLATE_CACHE_MAX`, default 500;
`BP_TEMPLATE_CACHE_TTL_MS`, default 300 000 ms), keyed with source mtime so edits
invalidate the cache.

## Rendering Lifecycle

```text
1. bp init <backend>
2. detect(projectRoot) → Fingerprint
3. Template pack selection: [language + framework] → language base → generic fallback
4. For each template:
   a. compile .hbs (cached) and render with TemplateContext
   b. block-level merge with any existing file:
      bp-generated blocks are replaced, bp:preserve blocks kept verbatim
   c. write the file; record it in .bp/manifest.json (ownership)
5. Write .bp-fingerprint.json
6. Post-init validation (unless --no-verify)
```

See [Template Authoring](../template-authoring.md) for the pack layout and merge
marker reference.
