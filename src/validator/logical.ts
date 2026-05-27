import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { ValidationError } from "./structural.js";

// ---------------------------------------------------------------------------
// Antonym pairs for semantic contradiction detection
// ---------------------------------------------------------------------------
const ANTONYM_PAIRS: Array<[string, string]> = [
  ["must use", "must not use"],
  ["must use", "never use"],
  ["always use", "never use"],
  ["always use", "must not use"],
  ["require", "forbid"],
  ["require", "prohibited"],
  ["enforce", "disable"],
  ["enable", "disable"],
  ["allow", "deny"],
  ["allow", "block"],
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RuleInfo {
  file: string;
  scope: string;
  severity: "hard" | "soft" | "info";
  action: string;
  lineNum: number;
  fileSet?: Set<string>; // materialised by fast-glob
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileSafe(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function parseRule(filePath: string): RuleInfo | null {
  const content = readFileSafe(filePath);
  if (!content) return null;

  let fm: Record<string, unknown>;
  try {
    fm = matter(content).data as Record<string, unknown>;
  } catch {
    return null;
  }

  const scope = typeof fm.scope === "string" ? fm.scope : "**/*";
  const severity = (["hard", "soft", "info"] as const).includes(
    fm.severity as "hard" | "soft" | "info"
  )
    ? (fm.severity as "hard" | "soft" | "info")
    : "soft";
  const action = typeof fm.action === "string" ? fm.action : "";

  // Approximate line number for scope field
  const lines = content.split("\n");
  const scopeLine = lines.findIndex((l) => l.startsWith("scope:")) + 1;

  return { file: filePath, scope, severity, action, lineNum: scopeLine > 0 ? scopeLine : 1 };
}

// ---------------------------------------------------------------------------
// Tarjan's SCC for circular skill dependency detection
// ---------------------------------------------------------------------------

interface SkillGraph {
  nodes: string[]; // file paths
  edges: Map<string, string[]>; // file → [deps]
}

function buildSkillGraph(skillFiles: string[]): SkillGraph {
  const edges = new Map<string, string[]>();
  const skillDir = skillFiles.length > 0 ? path.dirname(skillFiles[0] ?? "") : "";

  for (const file of skillFiles) {
    const content = readFileSafe(file);
    if (!content) {
      edges.set(file, []);
      continue;
    }

    let fm: Record<string, unknown>;
    try {
      fm = matter(content).data as Record<string, unknown>;
    } catch {
      edges.set(file, []);
      continue;
    }

    const deps: string[] = [];
    const uses = fm.uses ?? fm.requires_skills ?? fm.skills;
    if (Array.isArray(uses)) {
      for (const dep of uses) {
        if (typeof dep === "string") {
          const candidate = path.join(skillDir, `${dep}.md`);
          if (skillFiles.includes(candidate)) deps.push(candidate);
        }
      }
    }
    edges.set(file, deps);
  }

  return { nodes: skillFiles, edges };
}

function tarjanSCC(graph: SkillGraph): string[][] {
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Map<string, boolean>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let counter = 0;

  const strongconnect = (v: string): void => {
    index.set(v, counter);
    lowlink.set(v, counter);
    counter++;
    stack.push(v);
    onStack.set(v, true);

    for (const w of graph.edges.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(w) ?? 0));
      } else if (onStack.get(w)) {
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, index.get(w) ?? 0));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w = stack.pop() ?? "";
      while (true) {
        onStack.set(w, false);
        scc.push(w);
        if (w === v) break;
        w = stack.pop() ?? "";
      }
      sccs.push(scc);
    }
  };

  for (const node of graph.nodes) {
    if (!index.has(node)) strongconnect(node);
  }

  return sccs.filter((scc) => scc.length > 1); // only cycles
}

// ---------------------------------------------------------------------------
// Box-drawing conflict report (matches SPEC §3.3 format)
// ---------------------------------------------------------------------------

function conflictReport(
  ruleA: RuleInfo,
  ruleB: RuleInfo,
  intersection: string[],
  projectRoot: string
): string {
  const bar = "═".repeat(63);
  const relA = path.relative(projectRoot, ruleA.file);
  const relB = path.relative(projectRoot, ruleB.file);
  const sample = intersection.slice(0, 4).join(", ");
  const extra = intersection.length > 4 ? ` (and ${intersection.length - 4} other files)` : "";

  return [
    `[CRITICAL] Rule Conflict Detected`,
    bar,
    `Rule A: ${relA} (line ${ruleA.lineNum})`,
    `  Scope: ${ruleA.scope}`,
    `  Action: ${ruleA.action || "(no action field)"}`,
    `  Severity: ${ruleA.severity}`,
    ``,
    `Rule B: ${relB} (line ${ruleB.lineNum})`,
    `  Scope: ${ruleB.scope}`,
    `  Action: ${ruleB.action || "(no action field)"}`,
    `  Severity: ${ruleB.severity}`,
    ``,
    `Intersection: ${sample}${extra}`,
    ``,
    `Suggested Resolutions:`,
    `  [1] Narrow Rule A scope to exclude the intersection`,
    `  [2] Narrow Rule B scope to exclude the intersection`,
    `  [3] Downgrade one rule's severity to: soft`,
    `  [4] Merge into one rule with conditional logic`,
    `  [5] Add explicit precedence in 04-meta.md`,
    bar,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Check 1: Scope intersection
// ---------------------------------------------------------------------------

async function checkScopeIntersection(
  ruleFiles: string[],
  projectRoot: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Parse all rules
  const rules: RuleInfo[] = [];
  for (const f of ruleFiles) {
    const r = parseRule(f);
    if (r) rules.push(r);
  }

  // Materialise file sets via fast-glob
  for (const rule of rules) {
    try {
      const matches = await fg(rule.scope, {
        cwd: projectRoot,
        onlyFiles: true,
        dot: true,
        ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
        // ADR-004: sample cap 10,000 files
      });
      rule.fileSet = new Set(matches);
    } catch {
      rule.fileSet = new Set();
    }
  }

  // Pairwise intersection check
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (!a || !b) continue;

      if (!a.fileSet || !b.fileSet || a.fileSet.size === 0 || b.fileSet.size === 0) continue;

      const intersection = [...a.fileSet].filter((f) => b.fileSet?.has(f));
      if (intersection.length === 0) continue;

      const bothHard = a.severity === "hard" && b.severity === "hard";
      const oneHard = a.severity === "hard" || b.severity === "hard";

      if (bothHard) {
        errors.push({
          file: a.file,
          line: a.lineNum,
          type: "RULE_CONFLICT_HARD",
          severity: "error",
          message: conflictReport(a, b, intersection, projectRoot),
          resolution: "See Suggested Resolutions in the conflict report above",
        });
      } else if (oneHard) {
        errors.push({
          file: a.file,
          line: a.lineNum,
          type: "RULE_CONFLICT_SOFT",
          severity: "warning",
          message: `Scope overlap between ${path.basename(a.file)} and ${path.basename(b.file)} (${intersection.length} file(s))`,
          resolution: "Narrow one scope or add precedence order in 04-meta.md",
        });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Check 2: Keyword antonym matching
// ---------------------------------------------------------------------------

function checkAntonyms(ruleFiles: string[], _projectRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];

  const rules = ruleFiles
    .map((f) => ({ file: f, rule: parseRule(f) }))
    .filter((r) => r.rule !== null) as Array<{ file: string; rule: RuleInfo }>;

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]?.rule;
      const b = rules[j]?.rule;

      if (!a || !b) continue;

      const actionA = a.action.toLowerCase();
      const actionB = b.action.toLowerCase();

      for (const [termA, termB] of ANTONYM_PAIRS) {
        if (
          (actionA.includes(termA) && actionB.includes(termB)) ||
          (actionA.includes(termB) && actionB.includes(termA))
        ) {
          errors.push({
            file: a.file,
            line: a.lineNum,
            type: "SEMANTIC_CONTRADICTION",
            severity: "error",
            message: `Semantic contradiction: "${path.basename(a.file)}" says "${a.action}" but "${path.basename(b.file)}" says "${b.action}"`,
            resolution: `Reconcile contradictory rules — merge, remove one, or restrict scopes so they don't both apply`,
          });
          break;
        }
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Check 3: Circular skill dependencies (Tarjan SCC)
// ---------------------------------------------------------------------------

function checkCircularSkillDeps(skillFiles: string[], projectRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];

  const graph = buildSkillGraph(skillFiles);
  const cycles = tarjanSCC(graph);

  for (const cycle of cycles) {
    const names = cycle.map((f) => path.relative(projectRoot, f)).join(" → ");
    errors.push({
      file: cycle[0] ?? skillFiles[0] ?? "unknown",
      type: "CIRCULAR_SKILL_DEPENDENCY",
      severity: "error",
      message: `Circular skill dependency detected: ${names}`,
      resolution: "Remove or refactor the circular dependency chain between these skills",
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LogicalValidatorOptions {
  projectRoot: string;
}

export async function validateLogical(
  files: string[],
  options: LogicalValidatorOptions
): Promise<ValidationError[]> {
  const { projectRoot } = options;

  const ruleFiles = files.filter((f) => f.includes("/rules/") && f.endsWith(".md"));
  const skillFiles = files.filter((f) => f.includes("/skills/") && f.endsWith(".md"));

  const [intersectionErrors, circularErrors] = await Promise.all([
    checkScopeIntersection(ruleFiles, projectRoot),
    Promise.resolve(checkCircularSkillDeps(skillFiles, projectRoot)),
  ]);

  const antonymErrors = checkAntonyms(ruleFiles, projectRoot);

  return [...intersectionErrors, ...antonymErrors, ...circularErrors];
}
