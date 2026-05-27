import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";
import type { Fingerprint } from "../detector/fingerprint.js";
import type { ValidationError } from "./structural.js";

export const FINGERPRINT_FILE = ".bp-fingerprint.json";

// ---------------------------------------------------------------------------
// Fingerprint storage
// ---------------------------------------------------------------------------

export function loadStoredFingerprint(projectRoot: string): Fingerprint | null {
  const fp = path.join(projectRoot, FINGERPRINT_FILE);
  try {
    const raw = fs.readFileSync(fp, "utf-8");
    return JSON.parse(raw) as Fingerprint;
  } catch {
    return null;
  }
}

export function storeFingerprint(projectRoot: string, fingerprint: Fingerprint): void {
  const fp = path.join(projectRoot, FINGERPRINT_FILE);
  fs.writeFileSync(fp, JSON.stringify(fingerprint, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Check 1: Fingerprint delta
// ---------------------------------------------------------------------------

export interface DriftDelta {
  field: string;
  old: unknown;
  current: unknown;
}

export function computeFingerprintDelta(stored: Fingerprint, current: Fingerprint): DriftDelta[] {
  const deltas: DriftDelta[] = [];

  // Project type / workflow changes
  if (stored.project.type !== current.project.type) {
    deltas.push({ field: "project.type", old: stored.project.type, current: current.project.type });
  }
  if (stored.project.git_workflow !== current.project.git_workflow) {
    deltas.push({
      field: "project.git_workflow",
      old: stored.project.git_workflow,
      current: current.project.git_workflow,
    });
  }

  // Primary language change
  const storedPrimary = stored.languages.find((l) => l.primary)?.name;
  const currentPrimary = current.languages.find((l) => l.primary)?.name;
  if (storedPrimary !== currentPrimary) {
    deltas.push({ field: "primary_language", old: storedPrimary, current: currentPrimary });
  }

  // Test command change
  if (stored.tooling.test_command !== current.tooling.test_command) {
    deltas.push({
      field: "tooling.test_command",
      old: stored.tooling.test_command,
      current: current.tooling.test_command,
    });
  }

  // Package manager change
  if (stored.tooling.package_manager !== current.tooling.package_manager) {
    deltas.push({
      field: "tooling.package_manager",
      old: stored.tooling.package_manager,
      current: current.tooling.package_manager,
    });
  }

  // New major frameworks
  const storedFrameworks = new Set(stored.frameworks.map((f) => f.name));
  for (const fw of current.frameworks) {
    if (!storedFrameworks.has(fw.name) && fw.confidence >= 0.8) {
      deltas.push({ field: `frameworks.new`, old: null, current: fw.name });
    }
  }

  return deltas;
}

// ---------------------------------------------------------------------------
// Check 2: Entry point drift
// ---------------------------------------------------------------------------

function checkEntryPointDrift(files: string[], projectRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Find the spatial anchor (CLAUDE.md)
  const anchorFile = files.find((f) => f.endsWith("CLAUDE.md") || f.endsWith("/CLAUDE.md"));
  if (!anchorFile) return errors;

  const content = fs.existsSync(anchorFile)
    ? (() => {
        try {
          return fs.readFileSync(anchorFile, "utf-8");
        } catch {
          return null;
        }
      })()
    : null;
  if (!content) return errors;

  // Extract entry point paths from anchor (look for "Entry:" lines)
  const entryPattern = /[-*]\s*Entry(?:\s+point)?:\s*`?([^\s`\n]+)`?/gi;
  let match = entryPattern.exec(content);
  while (match !== null) {
    const entryPath = match[1];
    if (entryPath) {
      const absPath = path.join(projectRoot, entryPath);
      if (!fs.existsSync(absPath)) {
        errors.push({
          file: anchorFile,
          type: "ENTRY_POINT_DRIFT",
          severity: "warning",
          message: `Entry point declared in CLAUDE.md no longer exists: ${entryPath}`,
          resolution: `Run \`bp sync\` to update the spatial anchor, or recreate the file at ${entryPath}`,
        });
      }
    }
    match = entryPattern.exec(content);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Check 3: Test command drift
// ---------------------------------------------------------------------------

function checkTestCommandDrift(
  files: string[],
  _projectRoot: string,
  currentFingerprint: Fingerprint
): ValidationError[] {
  const errors: ValidationError[] = [];

  const anchorFile = files.find((f) => f.endsWith("CLAUDE.md"));
  if (!anchorFile) return errors;

  const content = fs.existsSync(anchorFile)
    ? (() => {
        try {
          return fs.readFileSync(anchorFile, "utf-8");
        } catch {
          return null;
        }
      })()
    : null;
  if (!content) return errors;

  // Extract test command from anchor
  const testCmdMatch = content.match(/[-*]\s*Test\s+command:\s*`([^`]+)`/i);
  if (!testCmdMatch) return errors;

  const anchorTestCmd = testCmdMatch[1];
  const currentTestCmd = currentFingerprint.tooling.test_command;

  if (anchorTestCmd && currentTestCmd && anchorTestCmd !== currentTestCmd) {
    errors.push({
      file: anchorFile,
      type: "TEST_COMMAND_DRIFT",
      severity: "warning",
      message: `Test command in CLAUDE.md ("${anchorTestCmd}") differs from detected command ("${currentTestCmd}")`,
      resolution: `Run \`bp sync\` to update the test command in CLAUDE.md, or run \`bp init --force\` to regenerate`,
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Check 4: Directory topology drift (new src/test dirs with no rule coverage)
// ---------------------------------------------------------------------------

async function checkTopologyDrift(
  files: string[],
  projectRoot: string,
  currentFingerprint: Fingerprint
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Collect all rule scopes
  const ruleFiles = files.filter((f) => f.includes("/rules/") && f.endsWith(".md"));
  const coveredScopes: string[] = [];

  for (const ruleFile of ruleFiles) {
    try {
      const content = fs.readFileSync(ruleFile, "utf-8");
      const parsed = matter(content);
      const data = parsed.data || {};
      const fm: Record<string, unknown> = Object.create(null);
      if (typeof data === "object" && data !== null) {
        for (const [k, v] of Object.entries(data)) {
          if (k !== "__proto__" && k !== "constructor") {
            fm[k] = v;
          }
        }
      }
      if (typeof fm.scope === "string") coveredScopes.push(fm.scope);
    } catch {
      /* skip */
    }
  }

  // Check each src/test dir for rule coverage
  const dirsToCheck = [
    ...currentFingerprint.directory_topology.src_dirs,
    ...currentFingerprint.directory_topology.test_dirs,
  ];

  for (const dir of dirsToCheck) {
    const isCovered = coveredScopes.some(
      (scope) =>
        scope.includes(`${dir}/`) ||
        scope.includes(`${dir}/**`) ||
        scope === "**/*" ||
        scope === "src/**" ||
        scope.startsWith(`${dir}`)
    );

    if (!isCovered) {
      errors.push({
        file: path.join(projectRoot, dir),
        type: "UNCOVERED_DIRECTORY",
        severity: "warning",
        message: `Directory "${dir}" has no rule coverage`,
        resolution: `Add a rule with scope: "${dir}/**" or broaden an existing rule's scope`,
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Check 5: Dependency drift (new major deps, no corresponding skill or rule)
// ---------------------------------------------------------------------------

function checkDependencyDrift(
  files: string[],
  projectRoot: string,
  stored: Fingerprint | null,
  current: Fingerprint
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!stored) return errors; // No baseline to compare

  // Collect known rule/skill topics from frontmatter tags
  const knownTopics: string[] = [];
  for (const f of files) {
    if (!f.endsWith(".md")) continue;
    try {
      const content = fs.readFileSync(f, "utf-8");
      const parsed = matter(content);
      const data = parsed.data || {};
      const fm: Record<string, unknown> = Object.create(null);
      if (typeof data === "object" && data !== null) {
        for (const [k, v] of Object.entries(data)) {
          if (k !== "__proto__" && k !== "constructor") {
            fm[k] = v;
          }
        }
      }
      const tags = fm.tags;
      if (Array.isArray(tags)) knownTopics.push(...tags.map(String));
      const name = fm.name;
      if (typeof name === "string") knownTopics.push(name);
    } catch {
      /* skip */
    }
  }

  // New frameworks = potential uncovered dependencies
  const storedFrameworks = new Set(stored.frameworks.map((f) => f.name));
  for (const fw of current.frameworks) {
    if (!storedFrameworks.has(fw.name) && fw.confidence >= 0.8) {
      const isCovered = knownTopics.some((t) => t.toLowerCase().includes(fw.name.toLowerCase()));
      if (!isCovered) {
        errors.push({
          file: projectRoot,
          type: "DEPENDENCY_DRIFT",
          severity: "warning",
          message: `New dependency detected: "${fw.name}" — no corresponding skill or rule found`,
          resolution: `Add a rule or skill covering "${fw.name}" usage patterns, or tag an existing one with "${fw.name}"`,
        });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DriftValidatorOptions {
  projectRoot: string;
  currentFingerprint: Fingerprint;
}

export async function validateDrift(
  files: string[],
  options: DriftValidatorOptions
): Promise<ValidationError[]> {
  const { projectRoot, currentFingerprint } = options;
  const allErrors: ValidationError[] = [];

  const stored = loadStoredFingerprint(projectRoot);

  // Check 1: Fingerprint delta → report as warnings
  if (stored) {
    const deltas = computeFingerprintDelta(stored, currentFingerprint);
    for (const delta of deltas) {
      allErrors.push({
        file: path.join(projectRoot, FINGERPRINT_FILE),
        type: "FINGERPRINT_DELTA",
        severity: "warning",
        message: `Drift detected in ${delta.field}: was "${String(delta.old)}", now "${String(delta.current)}"`,
        resolution: `Run \`bp sync\` to update the blueprint, or run \`bp init --force\` to regenerate`,
      });
    }
  }

  // Checks 2–5 run regardless of stored fingerprint
  allErrors.push(...checkEntryPointDrift(files, projectRoot));
  allErrors.push(...checkTestCommandDrift(files, projectRoot, currentFingerprint));

  const [topologyErrors, dependencyErrors] = await Promise.all([
    checkTopologyDrift(files, projectRoot, currentFingerprint),
    Promise.resolve(checkDependencyDrift(files, projectRoot, stored, currentFingerprint)),
  ]);

  allErrors.push(...topologyErrors, ...dependencyErrors);

  return allErrors;
}
