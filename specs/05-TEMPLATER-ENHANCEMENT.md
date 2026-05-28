# Domain: Templater Engine Enhancement
**Priority:** P1 · **Status:** ⚠️ NOT STARTED — Template inheritance done, conditional + risk-aware missing · **Dependencies:** `01-IR-SCHEMA-FOUNDATION.md`, `03-DETECTOR-ENHANCEMENT.md`
**Agent Boundary:** Base templater with Handlebars and inheritance is complete. Your job is conditional template generation and risk-aware template packs.

---

## 1. Current State (Verified from Repo)

`src/templater/index.ts` already implements:
- ✅ Handlebars rendering with base partials
- ✅ Template fallback chain: framework-specific → language-base → generic
- ✅ Block-level merging with `bp-generated` markers
- ✅ Template inheritance via `.bp.json` `extends` field (recursive resolution)
- ✅ `buildContext()` includes risk_tier, approval_mode, estimated_monthly_tokens
- ✅ `.blueprintignore` generation
- ✅ `.bp-fingerprint.json` writing

**Missing:**
- ❌ Conditional template rendering (skip templates based on risk tier, backend features)
- ❌ Risk-aware template packs (different rules for low vs critical)
- ❌ Template metadata frontmatter in `.hbs` files
- ❌ Multi-backend template inheritance (cascade: specific → generic)

---

## 2. Implementation Tasks

### Task 5.1: Template Metadata System
Create `src/templater/metadata.ts`:

```typescript
import * as fs from "node:fs";
import * as yaml from "yaml"; // May need to add dependency

export interface TemplateMetadata {
  render_if?: {
    risk_tier?: ("low" | "medium" | "high" | "critical")[];
    backend_features?: string[];
    min_bp_version?: string;
    languages?: string[];
    frameworks?: string[];
    project_types?: ("monorepo" | "polyrepo" | "library" | "application" | "service")[];
  };
  inherit_from?: string;
  layers?: number[];
  priority?: number;
}

export function parseTemplateMetadata(templatePath: string): TemplateMetadata {
  const content = fs.readFileSync(templatePath, "utf-8");

  // Check for YAML frontmatter in .hbs file
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!frontmatterMatch) return {};

  try {
    return yaml.parse(frontmatterMatch[1]) as TemplateMetadata;
  } catch {
    return {};
  }
}

export function stripMetadata(content: string): string {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
}
```

### Task 5.2: Conditional Rendering Engine
Create `src/templater/conditional.ts`:

```typescript
import type { Fingerprint } from "../detector/fingerprint.js";
import type { BackendManifest } from "./selector.js";
import type { TemplateContext } from "./index.js";
import type { TemplateMetadata } from "./metadata.js";

export interface RenderContext {
  risk_tier: "low" | "medium" | "high" | "critical";
  primary_language: string;
  primary_framework: string;
  project_type: string;
  backend_manifest: BackendManifest;
  bp_version: string;
}

export function shouldRenderTemplate(
  meta: TemplateMetadata,
  context: RenderContext
): { render: boolean; reason?: string } {
  if (!meta.render_if) return { render: true };

  // Risk tier check
  if (meta.render_if.risk_tier && !meta.render_if.risk_tier.includes(context.risk_tier)) {
    return {
      render: false,
      reason: `Risk tier '${context.risk_tier}' not in [${meta.render_if.risk_tier.join(", ")}]`,
    };
  }

  // Backend features check
  if (meta.render_if.backend_features) {
    for (const feat of meta.render_if.backend_features) {
      if (!context.backend_manifest.supported_features?.[feat]) {
        return {
          render: false,
          reason: `Backend does not support feature: ${feat}`,
        };
      }
    }
  }

  // Language check
  if (meta.render_if.languages && !meta.render_if.languages.includes(context.primary_language)) {
    return {
      render: false,
      reason: `Language '${context.primary_language}' not in [${meta.render_if.languages.join(", ")}]`,
    };
  }

  // Framework check
  if (meta.render_if.frameworks && !meta.render_if.frameworks.includes(context.primary_framework)) {
    return {
      render: false,
      reason: `Framework '${context.primary_framework}' not in [${meta.render_if.frameworks.join(", ")}]`,
    };
  }

  // Project type check
  if (meta.render_if.project_types && !meta.render_if.project_types.includes(context.project_type as any)) {
    return {
      render: false,
      reason: `Project type '${context.project_type}' not in [${meta.render_if.project_types.join(", ")}]`,
    };
  }

  // Version check
  if (meta.render_if.min_bp_version) {
    // Simple semver comparison
    if (context.bp_version < meta.render_if.min_bp_version) {
      return {
        render: false,
        reason: `Requires bp >= ${meta.render_if.min_bp_version}, have ${context.bp_version}`,
      };
    }
  }

  return { render: true };
}
```

### Task 5.3: Risk-Aware Template Packs
Create risk-specific template directories:

```
templates/
  _base/
    risk-low/
      rules-minimal.md.hbs
    risk-medium/
      rules-standard.md.hbs
    risk-high/
      rules-strict.md.hbs
      escalation.md.hbs
    risk-critical/
      rules-maximum.md.hbs
      escalation.md.hbs
      compliance-checklist.md.hbs
```

Create `src/templater/risk-selector.ts`:

```typescript
import * as path from "node:path";
import { getTemplatesRoot } from "./selector.js";

export function resolveRiskTemplatePack(
  basePackDir: string,
  riskTier: "low" | "medium" | "high" | "critical"
): string | undefined {
  const riskDir = path.join(getTemplatesRoot(), "_base", `risk-${riskTier}`);
  // Check if risk-specific templates exist
  if (fs.existsSync(riskDir)) {
    return riskDir;
  }
  return undefined;
}

export function mergeRiskTemplates(
  baseFiles: string[],
  riskFiles: string[]
): string[] {
  // Risk files override base files with same name
  const baseMap = new Map(baseFiles.map(f => [path.basename(f), f]));
  for (const riskFile of riskFiles) {
    baseMap.set(path.basename(riskFile), riskFile);
  }
  return Array.from(baseMap.values());
}
```

### Task 5.4: Template Inheritance Enhancement
Create `src/templater/inheritance.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

export interface InheritanceChain {
  chain: string[];
  mergedContent: string;
}

export function buildInheritanceChain(
  templatePath: string,
  registry: Map<string, string>
): InheritanceChain {
  const chain: string[] = [];
  const visited = new Set<string>();

  let current = templatePath;
  while (current && !visited.has(current)) {
    visited.add(current);
    chain.push(current);

    const meta = parseTemplateMetadata(current);
    if (meta.inherit_from) {
      current = registry.get(meta.inherit_from) || 
                path.resolve(path.dirname(current), meta.inherit_from);
    } else {
      break;
    }
  }

  // Merge from base (end of chain) to specific (start)
  let merged = "";
  for (let i = chain.length - 1; i >= 0; i--) {
    const content = stripMetadata(fs.readFileSync(chain[i], "utf-8"));
    merged = mergeTemplateBodies(merged, content);
  }

  return { chain: chain.reverse(), mergedContent: merged };
}

function mergeTemplateBodies(base: string, override: string): string {
  // Use bp-override markers
  const overrideBlocks = extractOverrideBlocks(override);
  let result = base;
  for (const [id, content] of overrideBlocks) {
    const marker = `<!-- bp-inherit:${id} -->`;
    if (result.includes(marker)) {
      result = result.replace(marker, content);
    }
  }
  return result + "\n" + override;
}

function extractOverrideBlocks(content: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const regex = /<!-- bp-override:begin ([\w-]+) -->([\s\S]*?)<!-- bp-override:end \1 -->/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.set(match[1], match[2].trim());
  }
  return blocks;
}
```

### Task 5.5: Integrate into Templater
Update `src/templater/index.ts`:
- [ ] Parse metadata from each `.hbs` file before rendering
- [ ] Call `shouldRenderTemplate()` — skip if conditions not met
- [ ] Log skipped templates when `--verbose` flag is set
- [ ] Build render context with risk tier from fingerprint
- [ ] Merge risk-specific templates before base templates
- [ ] Support `inherit_from` in template metadata

### Task 5.6: Example Template with Metadata
Update `templates/claude/rules/02-security.md.hbs`:

```handlebars
---
render_if:
  risk_tier: ["medium", "high", "critical"]
  backend_features: ["rules"]
inherit_from: "templates/_base/partials/security-rules.md.hbs"
---
<!-- bp-generated:begin security -->
# Security Rules

{{#if (eq risk_tier "critical")}}
## Maximum Security
- All external API calls must be audited
- All secrets must use vault integration
- All database queries must be parameterized
{{else if (eq risk_tier "high")}}
## Strict Security
- External APIs require approval
- Secrets must not be hardcoded
- Input validation required
{{else}}
## Standard Security
- Follow OWASP guidelines
- Use HTTPS for external calls
{{/if}}
<!-- bp-generated:end security -->
```

---

## 3. Acceptance Criteria

- [ ] Templates can declare `render_if` conditions and be conditionally skipped
- [ ] Risk-aware packs generate different output for low vs critical tiers
- [ ] Template inheritance chain resolves correctly (base → specific)
- [ ] `--verbose` logs which templates were skipped and why
- [ ] Layer 6-8 templates render for backends that support them
- [ ] `npm run typecheck` exits 0
- [ ] 40+ new tests, all passing
- [ ] No regression in existing template rendering

---

## 4. Cross-References

| Concern | File | Status |
|---------|------|--------|
| IR schema for conditional context | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Risk tier from detector | `03-DETECTOR-ENHANCEMENT.md` | ⚠️ Partial |
| Backend adapters | `02-BACKEND-EXPANSION.md` | ✅ Complete |
| Enterprise governance templates | `06-ENTERPRISE-GOVERNANCE.md` | ⚠️ Partial |

---

*Domain Spec: Templater Enhancement · open-blueprint v2.0*
