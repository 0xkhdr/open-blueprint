# Domain: Ecosystem & Scale
**Priority:** P3 · **Status:** ⚠️ PARTIAL — Basic registry done, marketplace v2 + rule packs + diff/merge missing · **Dependencies:** All previous domains
**Agent Boundary:** Template registry client exists. Your job is marketplace v2 features, shared rule library, semantic diff/merge, and optional SaaS.

---

## 1. Current State (Verified from Repo)

Already implemented:
- ✅ `bp template list` — list available packs
- ✅ `bp template add <path>` — install custom local pack
- ✅ `bp template install <pkg>` — install from npm registry
- ✅ `bp template publish <path>` — publish to registry
- ✅ `bp template update` — update all installed packs

**Missing:**
- ❌ Marketplace ratings and reviews
- ❌ Verified publisher badges
- ❌ Dependency graph resolution
- ❌ Shared compliance rule packs
- ❌ Semantic diff engine (not text diff)
- ❌ Three-way merge with conflict resolution
- ❌ Enterprise template inheritance (deep merge)
- ❌ SaaS governance dashboard

---

## 2. Implementation Tasks

### Task 11.1: Marketplace v2
Create `src/ecosystem/marketplace-v2.ts`:

```typescript
export interface MarketplaceTemplate {
  name: string;
  version: string;
  author: string;
  verified: boolean;
  rating: number;
  downloads: number;
  dependencies: string[];
  backends: string[];
  frameworks: string[];
  risk_tiers: string[];
  compliance: string[];
  layers: number[];
  min_bp_version: string;
}

export interface MarketplaceRating {
  user: string;
  rating: number; // 1-5
  comment: string;
  timestamp: string;
  version: string;
}

export interface MarketplaceSearchResult {
  templates: MarketplaceTemplate[];
  total: number;
  filters: {
    backends: string[];
    frameworks: string[];
    risk_tiers: string[];
    compliance: string[];
  };
}

export async function searchMarketplace(
  query: string,
  filters?: {
    backend?: string;
    framework?: string;
    risk_tier?: string;
    compliance?: string;
    verified_only?: boolean;
  }
): Promise<MarketplaceSearchResult> {
  // Query npm registry or custom marketplace API
  const registry = "https://registry.npmjs.org";
  const searchUrl = `${registry}/-/v1/search?text=${encodeURIComponent(query)}&scope=@bp-templates`;

  const response = await fetch(searchUrl);
  const data = await response.json();

  let templates = data.objects.map((obj: any) => ({
    name: obj.package.name,
    version: obj.package.version,
    author: obj.package.author?.name || "unknown",
    verified: obj.package.name.startsWith("@bp-templates/"),
    rating: 0, // Would come from separate rating service
    downloads: obj.downloads?.monthly || 0,
    dependencies: Object.keys(obj.package.dependencies || {}),
    backends: obj.package.keywords?.filter((k: string) => k.startsWith("backend:")).map((k: string) => k.replace("backend:", "")) || [],
    frameworks: obj.package.keywords?.filter((k: string) => k.startsWith("framework:")).map((k: string) => k.replace("framework:", "")) || [],
    risk_tiers: obj.package.keywords?.filter((k: string) => k.startsWith("risk:")).map((k: string) => k.replace("risk:", "")) || [],
    compliance: obj.package.keywords?.filter((k: string) => k.startsWith("compliance:")).map((k: string) => k.replace("compliance:", "")) || [],
    layers: [],
    min_bp_version: obj.package.engines?.["@agentic/bp"] || "1.0.0",
  }));

  // Apply filters
  if (filters?.backend) {
    templates = templates.filter((t: MarketplaceTemplate) => t.backends.includes(filters.backend!));
  }
  if (filters?.verified_only) {
    templates = templates.filter((t: MarketplaceTemplate) => t.verified);
  }

  return {
    templates,
    total: templates.length,
    filters: {
      backends: [...new Set(templates.flatMap((t: MarketplaceTemplate) => t.backends))],
      frameworks: [...new Set(templates.flatMap((t: MarketplaceTemplate) => t.frameworks))],
      risk_tiers: [...new Set(templates.flatMap((t: MarketplaceTemplate) => t.risk_tiers))],
      compliance: [...new Set(templates.flatMap((t: MarketplaceTemplate) => t.compliance))],
    },
  };
}

export async function rateTemplate(
  templateName: string,
  rating: number,
  comment: string,
  authToken: string
): Promise<void> {
  // POST to rating service
  const response = await fetch(`https://marketplace.agentic.dev/api/ratings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
    },
    body: JSON.stringify({ template: templateName, rating, comment }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit rating: ${response.statusText}`);
  }
}

export async function getTemplateRatings(templateName: string): Promise<MarketplaceRating[]> {
  const response = await fetch(`https://marketplace.agentic.dev/api/ratings?template=${encodeURIComponent(templateName)}`);
  if (!response.ok) return [];
  return response.json();
}
```

### Task 11.2: Shared Rule Library
Create `src/ecosystem/rule-library.ts`:

```typescript
export interface RulePack {
  name: string;
  framework: string;
  version: string;
  rules: Array<{
    id: string;
    scope: string;
    severity: "hard" | "soft";
    action: string;
    rationale: string;
    tags: string[];
  }>;
  skills: Array<{
    name: string;
    description: string;
    when_to_use: string;
  }>;
  compliance_mapping: Array<{
    control_id: string;
    rule_id: string;
    description: string;
  }>;
}

export const BUILTIN_RULE_PACKS: Record<string, RulePack> = {
  gdpr: {
    name: "@bp-rules/gdpr",
    framework: "gdpr",
    version: "1.0.0",
    rules: [
      {
        id: "gdpr-data-minimization",
        scope: "src/**/*",
        severity: "hard",
        action: "Only collect and process personal data that is necessary for the specific purpose",
        rationale: "Article 5(1)(c) of GDPR requires data minimization",
        tags: ["gdpr", "art-5-1-c", "privacy"],
      },
      {
        id: "gdpr-consent-management",
        scope: "src/**/*",
        severity: "hard",
        action: "Obtain explicit consent before processing personal data. Consent must be freely given, specific, informed, and unambiguous",
        rationale: "Article 7 of GDPR sets conditions for consent",
        tags: ["gdpr", "art-7", "consent"],
      },
      {
        id: "gdpr-right-to-erasure",
        scope: "src/services/**/*",
        severity: "soft",
        action: "Implement data deletion endpoints that allow users to request erasure of their personal data",
        rationale: "Article 17 of GDPR grants the right to erasure",
        tags: ["gdpr", "art-17", "deletion"],
      },
      {
        id: "gdpr-data-protection-by-design",
        scope: "src/**/*",
        severity: "soft",
        action: "Implement technical and organizational measures to ensure data protection principles are integrated into processing activities",
        rationale: "Article 25 of GDPR requires data protection by design and default",
        tags: ["gdpr", "art-25", "design"],
      },
      {
        id: "gdpr-security-of-processing",
        scope: "src/**/*",
        severity: "hard",
        action: "Implement appropriate security measures including encryption, pseudonymization, and regular security assessments",
        rationale: "Article 32 of GDPR requires security of processing",
        tags: ["gdpr", "art-32", "security"],
      },
    ],
    skills: [
      {
        name: "gdpr-audit",
        description: "Perform a GDPR compliance audit on the codebase",
        when_to_use: "When reviewing code for GDPR compliance or before release",
      },
    ],
    compliance_mapping: [
      { control_id: "art-5-1-c", rule_id: "gdpr-data-minimization", description: "Data minimization principle" },
      { control_id: "art-7", rule_id: "gdpr-consent-management", description: "Conditions for consent" },
      { control_id: "art-17", rule_id: "gdpr-right-to-erasure", description: "Right to erasure" },
      { control_id: "art-25", rule_id: "gdpr-data-protection-by-design", description: "Data protection by design" },
      { control_id: "art-32", rule_id: "gdpr-security-of-processing", description: "Security of processing" },
    ],
  },
  soc2: {
    name: "@bp-rules/soc2",
    framework: "soc2",
    version: "1.0.0",
    rules: [
      {
        id: "soc2-logical-access",
        scope: "src/auth/**/*",
        severity: "hard",
        action: "Implement role-based access control with principle of least privilege",
        rationale: "CC6.1 requires logical access security",
        tags: ["soc2", "CC6.1", "access-control"],
      },
      {
        id: "soc2-access-removal",
        scope: "src/auth/**/*",
        severity: "soft",
        action: "Automatically revoke access when employees leave or change roles",
        rationale: "CC6.2 requires timely access removal",
        tags: ["soc2", "CC6.2", "access-removal"],
      },
      {
        id: "soc2-monitoring",
        scope: "src/logging/**/*",
        severity: "hard",
        action: "Log all system operations with timestamps, user IDs, and action details",
        rationale: "CC7.1 requires system operations monitoring",
        tags: ["soc2", "CC7.1", "monitoring"],
      },
    ],
    skills: [
      {
        name: "soc2-audit",
        description: "Perform a SOC 2 compliance audit",
        when_to_use: "Before SOC 2 audit or quarterly review",
      },
    ],
    compliance_mapping: [
      { control_id: "CC6.1", rule_id: "soc2-logical-access", description: "Logical access security" },
      { control_id: "CC6.2", rule_id: "soc2-access-removal", description: "Access removal" },
      { control_id: "CC7.1", rule_id: "soc2-monitoring", description: "System operations monitoring" },
    ],
  },
  hipaa: {
    name: "@bp-rules/hipaa",
    framework: "hipaa",
    version: "1.0.0",
    rules: [
      {
        id: "hipaa-access-control",
        scope: "src/**/*",
        severity: "hard",
        action: "Implement unique user identification and emergency access procedures for PHI",
        rationale: "164.312(a) requires access control",
        tags: ["hipaa", "164.312(a)", "phi"],
      },
      {
        id: "hipaa-audit-controls",
        scope: "src/logging/**/*",
        severity: "hard",
        action: "Implement hardware, software, and procedural mechanisms to record and examine access to PHI",
        rationale: "164.312(b) requires audit controls",
        tags: ["hipaa", "164.312(b)", "audit"],
      },
      {
        id: "hipaa-integrity",
        scope: "src/**/*",
        severity: "hard",
        action: "Implement mechanisms to authenticate and protect PHI from improper alteration or destruction",
        rationale: "164.312(c) requires integrity controls",
        tags: ["hipaa", "164.312(c)", "integrity"],
      },
    ],
    skills: [
      {
        name: "hipaa-audit",
        description: "Perform a HIPAA compliance audit",
        when_to_use: "When handling PHI or before HIPAA assessment",
      },
    ],
    compliance_mapping: [
      { control_id: "164.312(a)", rule_id: "hipaa-access-control", description: "Access control" },
      { control_id: "164.312(b)", rule_id: "hipaa-audit-controls", description: "Audit controls" },
      { control_id: "164.312(c)", rule_id: "hipaa-integrity", description: "Integrity" },
    ],
  },
};

export function installRulePack(packName: string, projectRoot: string): void {
  const pack = BUILTIN_RULE_PACKS[packName];
  if (!pack) {
    throw new Error(`Unknown rule pack: ${packName}. Available: ${Object.keys(BUILTIN_RULE_PACKS).join(", ")}`);
  }

  const rulesDir = path.join(projectRoot, ".claude", "rules");
  fs.mkdirSync(rulesDir, { recursive: true });

  for (const rule of pack.rules) {
    const ruleContent = generateRuleMarkdown(rule);
    const rulePath = path.join(rulesDir, `${rule.id}.md`);
    fs.writeFileSync(rulePath, ruleContent);
  }

  const skillsDir = path.join(projectRoot, ".claude", "skills");
  fs.mkdirSync(skillsDir, { recursive: true });

  for (const skill of pack.skills) {
    const skillContent = generateSkillMarkdown(skill);
    const skillPath = path.join(skillsDir, `${skill.name}.md`);
    fs.writeFileSync(skillPath, skillContent);
  }

  console.log(`✅ Installed ${pack.name} (${pack.rules.length} rules, ${pack.skills.length} skills)`);
}

function generateRuleMarkdown(rule: RulePack["rules"][0]): string {
  return `---
scope: "${rule.scope}"
severity: ${rule.severity}
tags: [${rule.tags.map(t => `"${t}"`).join(", ")}]
---

# ${rule.id}

${rule.action}

## Rationale

${rule.rationale}
`;
}

function generateSkillMarkdown(skill: RulePack["skills"][0]): string {
  return `---
name: "${skill.name}"
description: "${skill.description}"
when_to_use: "${skill.when_to_use}"
---

# ${skill.name}

${skill.description}

## When to Use

${skill.when_to_use}
`;
}
```

### Task 11.3: Semantic Diff & Merge
Create `src/ecosystem/diff.ts`:

```typescript
import type { BlueprintIR, Rule, Skill, Persona } from "../translator/ir.js";

export interface BlueprintDiff {
  added: Array<{ type: string; id: string; value: unknown }>;
  removed: Array<{ type: string; id: string; oldValue: unknown }>;
  modified: Array<{ type: string; id: string; oldValue: unknown; newValue: unknown; changes: string[] }>;
  unchanged: Array<{ type: string; id: string }>;
}

export function diffBlueprints(left: BlueprintIR, right: BlueprintIR): BlueprintDiff {
  const result: BlueprintDiff = {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
  };

  // Diff rules
  const leftRules = new Map(left.rules.map(r => [r.id, r]));
  const rightRules = new Map(right.rules.map(r => [r.id, r]));

  for (const [id, rule] of leftRules) {
    if (!rightRules.has(id)) {
      result.removed.push({ type: "rule", id, oldValue: rule });
    } else {
      const rightRule = rightRules.get(id)!;
      const changes = diffRule(rule, rightRule);
      if (changes.length > 0) {
        result.modified.push({ type: "rule", id, oldValue: rule, newValue: rightRule, changes });
      } else {
        result.unchanged.push({ type: "rule", id });
      }
    }
  }

  for (const [id, rule] of rightRules) {
    if (!leftRules.has(id)) {
      result.added.push({ type: "rule", id, value: rule });
    }
  }

  // Diff skills
  const leftSkills = new Map(left.skills.map(s => [s.name, s]));
  const rightSkills = new Map(right.skills.map(s => [s.name, s]));

  for (const [name, skill] of leftSkills) {
    if (!rightSkills.has(name)) {
      result.removed.push({ type: "skill", id: name, oldValue: skill });
    } else {
      const rightSkill = rightSkills.get(name)!;
      const changes = diffSkill(skill, rightSkill);
      if (changes.length > 0) {
        result.modified.push({ type: "skill", id: name, oldValue: skill, newValue: rightSkill, changes });
      } else {
        result.unchanged.push({ type: "skill", id: name });
      }
    }
  }

  for (const [name, skill] of rightSkills) {
    if (!leftSkills.has(name)) {
      result.added.push({ type: "skill", id: name, value: skill });
    }
  }

  // Diff personas
  const leftPersonas = new Map(left.personas.map(p => [p.name, p]));
  const rightPersonas = new Map(right.personas.map(p => [p.name, p]));

  for (const [name, persona] of leftPersonas) {
    if (!rightPersonas.has(name)) {
      result.removed.push({ type: "persona", id: name, oldValue: persona });
    } else {
      const rightPersona = rightPersonas.get(name)!;
      const changes = diffPersona(persona, rightPersona);
      if (changes.length > 0) {
        result.modified.push({ type: "persona", id: name, oldValue: persona, newValue: rightPersona, changes });
      } else {
        result.unchanged.push({ type: "persona", id: name });
      }
    }
  }

  for (const [name, persona] of rightPersonas) {
    if (!leftPersonas.has(name)) {
      result.added.push({ type: "persona", id: name, value: persona });
    }
  }

  return result;
}

function diffRule(left: Rule, right: Rule): string[] {
  const changes: string[] = [];
  if (left.scope !== right.scope) changes.push(`scope: "${left.scope}" → "${right.scope}"`);
  if (left.severity !== right.severity) changes.push(`severity: ${left.severity} → ${right.severity}`);
  if (left.action !== right.action) changes.push("action modified");
  if (left.rationale !== right.rationale) changes.push("rationale modified");
  const leftTags = new Set(left.tags || []);
  const rightTags = new Set(right.tags || []);
  const addedTags = [...rightTags].filter(t => !leftTags.has(t));
  const removedTags = [...leftTags].filter(t => !rightTags.has(t));
  if (addedTags.length) changes.push(`tags added: ${addedTags.join(", ")}`);
  if (removedTags.length) changes.push(`tags removed: ${removedTags.join(", ")}`);
  return changes;
}

function diffSkill(left: Skill, right: Skill): string[] {
  const changes: string[] = [];
  if (left.description !== right.description) changes.push("description modified");
  if (left.when_to_use !== right.when_to_use) changes.push("when_to_use modified");
  const leftTools = new Set(left.tools_required || []);
  const rightTools = new Set(right.tools_required || []);
  const addedTools = [...rightTools].filter(t => !leftTools.has(t));
  const removedTools = [...leftTools].filter(t => !rightTools.has(t));
  if (addedTools.length) changes.push(`tools added: ${addedTools.join(", ")}`);
  if (removedTools.length) changes.push(`tools removed: ${removedTools.join(", ")}`);
  return changes;
}

function diffPersona(left: Persona, right: Persona): string[] {
  const changes: string[] = [];
  if (left.role !== right.role) changes.push(`role: ${left.role} → ${right.role}`);
  if (left.reasoning_style !== right.reasoning_style) changes.push(`reasoning_style modified`);
  const leftTools = new Set(left.allowed_tools || []);
  const rightTools = new Set(right.allowed_tools || []);
  const addedTools = [...rightTools].filter(t => !leftTools.has(t));
  const removedTools = [...leftTools].filter(t => !rightTools.has(t));
  if (addedTools.length) changes.push(`tools added: ${addedTools.join(", ")}`);
  if (removedTools.length) changes.push(`tools removed: ${removedTools.join(", ")}`);
  return changes;
}
```

Create `src/ecosystem/merge.ts`:

```typescript
import type { BlueprintIR, Rule, Skill, Persona } from "../translator/ir.js";
import { diffBlueprints, type BlueprintDiff } from "./diff.js";

export interface MergeConflict {
  type: string;
  id: string;
  base: unknown;
  left: unknown;
  right: unknown;
  field: string;
}

export interface MergeResult {
  merged: BlueprintIR;
  conflicts: MergeConflict[];
  autoResolved: number;
}

export function threeWayMerge(
  base: BlueprintIR,
  left: BlueprintIR,
  right: BlueprintIR
): MergeResult {
  const conflicts: MergeConflict[] = [];
  let autoResolved = 0;

  // Start with left as base
  const merged: BlueprintIR = { ...left };

  // Diff base→left and base→right
  const leftDiff = diffBlueprints(base, left);
  const rightDiff = diffBlueprints(base, right);

  // Apply non-conflicting right changes
  for (const added of rightDiff.added) {
    const alreadyInLeft = leftDiff.added.some(a => a.id === added.id);
    if (!alreadyInLeft) {
      if (added.type === "rule") merged.rules = [...merged.rules, added.value as Rule];
      if (added.type === "skill") merged.skills = [...merged.skills, added.value as Skill];
      if (added.type === "persona") merged.personas = [...merged.personas, added.value as Persona];
      autoResolved++;
    }
  }

  for (const removed of rightDiff.removed) {
    const alsoRemovedByLeft = leftDiff.removed.some(r => r.id === removed.id);
    if (alsoRemovedByLeft) {
      // Both removed — already done
      autoResolved++;
    }
    // If left didn't remove, keep left's version (no action needed)
  }

  for (const modified of rightDiff.modified) {
    const leftModified = leftDiff.modified.find(m => m.id === modified.id);
    if (!leftModified) {
      // Only right modified — apply right's change
      applyModification(merged, modified);
      autoResolved++;
    } else {
      // Both modified — check for field-level conflicts
      for (const change of modified.changes) {
        const field = change.split(":")[0];
        const leftHasSameField = leftModified.changes.some(c => c.startsWith(field));
        if (leftHasSameField) {
          conflicts.push({
            type: modified.type,
            id: modified.id,
            base: (base as any)[`${modified.type}s`]?.find((x: any) => x.id === modified.id || x.name === modified.id),
            left: leftModified.newValue,
            right: modified.newValue,
            field,
          });
        }
      }
    }
  }

  return { merged, conflicts, autoResolved };
}

function applyModification(merged: BlueprintIR, mod: BlueprintDiff["modified"][0]): void {
  if (mod.type === "rule") {
    const idx = merged.rules.findIndex(r => r.id === mod.id);
    if (idx >= 0) merged.rules[idx] = mod.newValue as Rule;
  }
  if (mod.type === "skill") {
    const idx = merged.skills.findIndex(s => s.name === mod.id);
    if (idx >= 0) merged.skills[idx] = mod.newValue as Skill;
  }
  if (mod.type === "persona") {
    const idx = merged.personas.findIndex(p => p.name === mod.id);
    if (idx >= 0) merged.personas[idx] = mod.newValue as Persona;
  }
}

export function formatDiffReport(diff: BlueprintDiff): string {
  let report = "# Blueprint Diff Report\n\n";

  report += "## Summary\n";
  report += `- **Added:** ${diff.added.length}\n`;
  report += `- **Removed:** ${diff.removed.length}\n`;
  report += `- **Modified:** ${diff.modified.length}\n`;
  report += `- **Unchanged:** ${diff.unchanged.length}\n\n`;

  if (diff.added.length > 0) {
    report += "## Added\n";
    for (const item of diff.added) {
      report += `- **${item.type}:** ${item.id}\n`;
    }
    report += "\n";
  }

  if (diff.removed.length > 0) {
    report += "## Removed\n";
    for (const item of diff.removed) {
      report += `- **${item.type}:** ${item.id}\n`;
    }
    report += "\n";
  }

  if (diff.modified.length > 0) {
    report += "## Modified\n";
    for (const item of diff.modified) {
      report += `### ${item.type}: ${item.id}\n`;
      for (const change of item.changes) {
        report += `- ${change}\n`;
      }
      report += "\n";
    }
  }

  return report;
}

export function formatMergeReport(result: MergeResult): string {
  let report = "# Blueprint Merge Report\n\n";
  report += `- **Auto-resolved:** ${result.autoResolved}\n`;
  report += `- **Conflicts:** ${result.conflicts.length}\n\n`;

  if (result.conflicts.length > 0) {
    report += "## Conflicts Requiring Manual Resolution\n\n";
    for (const conflict of result.conflicts) {
      report += `### ${conflict.type}: ${conflict.id} (${conflict.field})\n`;
      report += "```\n";
      report += `Base:  ${JSON.stringify(conflict.base)}\n`;
      report += `Left:  ${JSON.stringify(conflict.left)}\n`;
      report += `Right: ${JSON.stringify(conflict.right)}\n`;
      report += "```\n\n";
    }
  }

  return report;
}
```

### Task 11.4: Enterprise Template Inheritance
Create `src/ecosystem/inheritance.ts`:

```typescript
import type { BlueprintIR } from "../translator/ir.js";

export type MergeStrategy = "deep" | "shallow" | "override";

export interface InheritanceConfig {
  extends: string | string[];
  merge_strategy: MergeStrategy;
  override_audit: boolean;
}

export interface OverrideAuditEntry {
  timestamp: string;
  source: string;
  target: string;
  path: string;
  old_value: unknown;
  new_value: unknown;
  reason?: string;
  author?: string;
}

export function mergeBlueprints(
  base: BlueprintIR,
  override: BlueprintIR,
  strategy: MergeStrategy = "deep",
  audit: OverrideAuditEntry[] = []
): BlueprintIR {
  switch (strategy) {
    case "deep":
      return deepMerge(base, override, audit);
    case "shallow":
      return { ...base, ...override };
    case "override":
      return override;
    default:
      return deepMerge(base, override, audit);
  }
}

function deepMerge(base: BlueprintIR, override: BlueprintIR, audit: OverrideAuditEntry[]): BlueprintIR {
  const merged: BlueprintIR = { ...base };

  // Merge rules (by id)
  const baseRules = new Map(base.rules.map(r => [r.id, r]));
  for (const rule of override.rules) {
    if (baseRules.has(rule.id)) {
      audit.push({
        timestamp: new Date().toISOString(),
        source: "override",
        target: "merged",
        path: `rules.${rule.id}`,
        old_value: baseRules.get(rule.id),
        new_value: rule,
      });
    }
    baseRules.set(rule.id, rule);
  }
  merged.rules = Array.from(baseRules.values());

  // Merge skills (by name)
  const baseSkills = new Map(base.skills.map(s => [s.name, s]));
  for (const skill of override.skills) {
    if (baseSkills.has(skill.name)) {
      audit.push({
        timestamp: new Date().toISOString(),
        source: "override",
        target: "merged",
        path: `skills.${skill.name}`,
        old_value: baseSkills.get(skill.name),
        new_value: skill,
      });
    }
    baseSkills.set(skill.name, skill);
  }
  merged.skills = Array.from(baseSkills.values());

  // Merge personas (by name)
  const basePersonas = new Map(base.personas.map(p => [p.name, p]));
  for (const persona of override.personas) {
    if (basePersonas.has(persona.name)) {
      audit.push({
        timestamp: new Date().toISOString(),
        source: "override",
        target: "merged",
        path: `personas.${persona.name}`,
        old_value: basePersonas.get(persona.name),
        new_value: persona,
      });
    }
    basePersonas.set(persona.name, persona);
  }
  merged.personas = Array.from(basePersonas.values());

  // Override settings, risk, compliance, etc. entirely
  if (override.settings) merged.settings = override.settings;
  if (override.risk) merged.risk = override.risk;
  if (override.compliance) merged.compliance = override.compliance;
  if (override.audit) merged.audit = override.audit;
  if (override.identity) merged.identity = override.identity;

  return merged;
}

export function writeOverrideAudit(audit: OverrideAuditEntry[], projectRoot: string): void {
  const auditPath = path.join(projectRoot, ".bp-override-audit.yaml");
  const content = yaml.stringify({ overrides: audit });
  fs.writeFileSync(auditPath, content);
}
```

---

## 3. Acceptance Criteria

- [ ] `bp marketplace search` returns filtered results with ratings
- [ ] `bp rules install gdpr` installs 5 GDPR rules + 1 skill
- [ ] `bp rules install soc2` installs 3 SOC2 rules + 1 skill
- [ ] `bp rules install hipaa` installs 3 HIPAA rules + 1 skill
- [ ] Template inheritance: org → team → project merges correctly with deep strategy
- [ ] Override audit trail logs all changes with timestamp and path
- [ ] `bp diff` produces semantic diff (not line diff) with added/removed/modified
- [ ] `bp merge` resolves non-conflicting changes automatically
- [ ] Merge report shows conflicts with base/left/right values
- [ ] 60+ new tests, all passing
- [ ] Coverage for `src/ecosystem/` ≥ 90%

---

## 4. Cross-References

| Concern | File | Status |
|---------|------|--------|
| IR schema for inheritance | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Registry client (base) | Original spec | ✅ Complete |
| Risk tier for rule packs | `03-DETECTOR-ENHANCEMENT.md` | ⚠️ Partial |
| Compliance mapping | `06-ENTERPRISE-GOVERNANCE.md` | ⚠️ Partial |
| Cost tracking aggregation | `08-OBSERVABILITY-COST.md` | ⚠️ Partial |
| Security for marketplace | `09-PRODUCTION-HARDENING.md` | ❌ Not started |

---

*Domain Spec: Ecosystem & Scale · open-blueprint v2.0*
