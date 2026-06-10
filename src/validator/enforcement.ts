import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { Fingerprint } from "../detector/fingerprint.js";
import { startSpan } from "../telemetry/tracer.js";
import type { BackendManifest } from "../templater/selector.js";
import { defaultResourceBudget, evaluateCheck } from "./checks/evaluate.js";
import type { Check } from "./checks/schema.js";
import { CheckSchema } from "./checks/schema.js";
import type { ValidationError } from "./structural.js";

// ---------------------------------------------------------------------------
// Enforcement layer — evaluates declarative rule checks against the repo.
// Hard-severity failing checks are errors; soft are warnings; rules without a
// check are honestly reported as manual (info), never counted as passing.
// ---------------------------------------------------------------------------

export interface EnforcementSummary {
  /** Rules with a check that was actually evaluated (pass or fail). */
  enforced: number;
  /** Evaluated checks that failed. */
  violations: number;
  /** Rules bp cannot evaluate automatically (no check, or unsupported). */
  manual: number;
}

export interface EnforcementResult {
  errors: ValidationError[];
  summary: EnforcementSummary;
}

/** 1-based line of the first `<field>:` key in the frontmatter block. */
function frontmatterFieldLine(content: string, field: string): number | undefined {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return undefined;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") break;
    if (new RegExp(`^${field}\\s*:`).test(line)) return i + 1;
  }
  return undefined;
}

async function collectRuleFiles(projectRoot: string, manifest: BackendManifest): Promise<string[]> {
  if (!manifest.file_patterns.rules) return [];
  const files = await fg(path.join(projectRoot, manifest.file_patterns.rules), {
    onlyFiles: true,
    dot: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  });
  return files.sort();
}

export async function validateEnforcementDetailed(
  projectRoot: string,
  manifest: BackendManifest,
  fingerprint?: Fingerprint
): Promise<EnforcementResult> {
  return startSpan("validator.enforcement", async () => {
    const errors: ValidationError[] = [];
    const summary: EnforcementSummary = { enforced: 0, violations: 0, manual: 0 };

    const ruleFiles = await collectRuleFiles(projectRoot, manifest);
    const ctx = { projectRoot, fingerprint, fileBudget: defaultResourceBudget() };

    for (const file of ruleFiles) {
      let content: string;
      try {
        content = await fsPromises.readFile(file, "utf-8");
      } catch {
        continue; // structural layer reports unreadable files
      }

      let data: Record<string, unknown>;
      try {
        data = matter(content).data as Record<string, unknown>;
      } catch {
        continue; // structural layer reports FRONTMATTER_PARSE_ERROR
      }

      const ruleId = typeof data.id === "string" ? data.id : path.basename(file, ".md");
      const severity = data.severity === "hard" ? "hard" : "soft";
      const action = typeof data.action === "string" ? data.action : "";
      const rationale = typeof data.rationale === "string" ? data.rationale : undefined;
      const checkLine = frontmatterFieldLine(content, "check");
      const severityLine = frontmatterFieldLine(content, "severity");
      const line = checkLine ?? severityLine ?? 1;

      if (data.check === undefined || data.check === null) {
        summary.manual++;
        errors.push({
          file,
          line,
          type: "RULE_MANUAL",
          severity: "info",
          message: `Rule '${ruleId}' is not machine-enforceable (no check); verify manually`,
          resolution:
            "Add a declarative 'check' to the rule frontmatter to make it auto-enforceable, or keep it as a documented manual control",
        });
        continue;
      }

      const parsed = CheckSchema.safeParse(data.check);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({
          file,
          line,
          type: "RULE_CHECK_INVALID",
          severity: "error",
          message: `Rule '${ruleId}' has an invalid check at '${issue?.path.join(".") || "(root)"}': ${issue?.message ?? "malformed check"}`,
          resolution:
            "Fix the 'check' frontmatter to conform to the Check schema (see docs/data-models.md)",
        });
        continue;
      }

      const outcome = await evaluateCheck(parsed.data as Check, ctx);

      if (outcome.unsupported) {
        summary.manual++;
        errors.push({
          file,
          line,
          type: "RULE_MANUAL",
          severity: "info",
          message: `Rule '${ruleId}' cannot be auto-enforced here: ${outcome.detail}`,
          resolution: "Verify this rule manually until bp supports this ecosystem",
        });
        continue;
      }

      summary.enforced++;
      if (!outcome.passed) {
        summary.violations++;
        const evidenceNote =
          outcome.evidence && outcome.evidence.length > 0
            ? ` Evidence: ${outcome.evidence.map((e) => (e.line ? `${e.file}:${e.line}` : e.file)).join(", ")}`
            : "";
        errors.push({
          file,
          line,
          type: "RULE_VIOLATION",
          severity: severity === "hard" ? "error" : "warning",
          message: `Rule '${ruleId}' violated — ${action || "(no action text)"}: ${outcome.detail}.${evidenceNote}`,
          resolution:
            rationale ??
            "Bring the repository into compliance with the rule's check, or adjust the check",
        });
      }
    }

    return { errors, summary };
  });
}

export async function validateEnforcement(
  projectRoot: string,
  manifest: BackendManifest,
  fingerprint?: Fingerprint
): Promise<ValidationError[]> {
  const result = await validateEnforcementDetailed(projectRoot, manifest, fingerprint);
  return result.errors;
}
