import * as path from "node:path";
import fg from "fast-glob";
import type { Fingerprint } from "../detector/fingerprint.js";
import type { BackendManifest } from "../templater/selector.js";
import { validateDrift } from "./drift.js";
import { validateLogical } from "./logical.js";
import { validateSemantic } from "./semantic.js";
import type { ValidationError } from "./structural.js";
import { validateStructuralBatch } from "./structural.js";

export type ValidationLevel = "structural" | "semantic" | "logical" | "drift" | "all";

export interface ValidatorOptions {
  level: ValidationLevel;
  projectRoot: string;
  manifest: BackendManifest;
  fingerprint?: Fingerprint;
  json?: boolean;
  failOn?: ValidationLevel;
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  level: ValidationLevel;
  filesChecked: number;
}

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  STRUCTURAL_FAILURE: 2,
  SEMANTIC_FAILURE: 3,
  LOGICAL_FAILURE: 4,
  DRIFT_DETECTED: 5,
  UNSUPPORTED_BACKEND: 6,
  TEMPLATE_NOT_FOUND: 7,
  PERMISSION_DENIED: 8,
  REGISTRY_UNREACHABLE: 9,
  SIGNATURE_FAILED: 10,
} as const;

async function collectBlueprintFiles(
  projectRoot: string,
  manifest: BackendManifest
): Promise<string[]> {
  const patterns: string[] = [
    ...manifest.file_patterns.anchor.map((p) => path.join(projectRoot, p)),
    path.join(projectRoot, manifest.file_patterns.rules),
    path.join(projectRoot, manifest.file_patterns.skills),
    path.join(projectRoot, manifest.file_patterns.agents),
  ];

  const files = await fg(patterns, {
    onlyFiles: true,
    dot: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  return files;
}

export async function runValidator(options: ValidatorOptions): Promise<ValidationResult> {
  const { level, projectRoot, manifest, fingerprint } = options;

  const files = await collectBlueprintFiles(projectRoot, manifest);
  const allErrors: ValidationError[] = [];

  // Layer 1: Structural (always run)
  const structuralErrors = validateStructuralBatch(files, manifest);
  allErrors.push(...structuralErrors);

  // Short-circuit: if structural hard failures exist, skip deeper layers
  const structuralHardFail = structuralErrors.some((e) => e.severity === "error");

  // Layer 2: Semantic
  if (!structuralHardFail && (level === "semantic" || level === "all")) {
    const semanticErrors = await validateSemantic(files, { projectRoot, manifest });
    allErrors.push(...semanticErrors);
  }

  // Layer 3: Logical
  if (!structuralHardFail && (level === "logical" || level === "all")) {
    const logicalErrors = await validateLogical(files, { projectRoot });
    allErrors.push(...logicalErrors);
  }

  // Layer 4: Drift
  if (level === "drift" || level === "all") {
    if (fingerprint) {
      const driftErrors = await validateDrift(files, {
        projectRoot,
        currentFingerprint: fingerprint,
      });
      allErrors.push(...driftErrors);
    }
  }

  const errors = allErrors.filter((e) => e.severity === "error");
  const warnings = allErrors.filter((e) => e.severity === "warning");
  const infos = allErrors.filter((e) => e.severity === "info");

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    infos,
    level,
    filesChecked: files.length,
  };
}

export function exitCodeForResult(result: ValidationResult): number {
  if (result.passed) return EXIT_CODES.SUCCESS;

  // Logical conflicts → exit 4
  const hasLogical = result.errors.some(
    (e) =>
      e.type === "RULE_CONFLICT_HARD" ||
      e.type === "SEMANTIC_CONTRADICTION" ||
      e.type === "CIRCULAR_SKILL_DEPENDENCY"
  );
  if (hasLogical) return EXIT_CODES.LOGICAL_FAILURE;

  // Semantic failures → exit 3
  const hasSemantic = result.errors.some(
    (e) =>
      e.type === "ZERO_MATCH_SCOPE" ||
      e.type === "INVALID_SCOPE_PATTERN" ||
      e.type === "MISSING_SKILL_REFERENCE" ||
      e.type === "UNKNOWN_TOOL_REFERENCE"
  );
  if (hasSemantic) return EXIT_CODES.SEMANTIC_FAILURE;

  // Structural failures → exit 2
  const hasStructural = result.errors.some(
    (e) =>
      e.type === "FILE_NOT_FOUND" ||
      e.type === "FRONTMATTER_PARSE_ERROR" ||
      e.type === "MISSING_REQUIRED_FIELD" ||
      e.type === "FILE_TOO_LARGE" ||
      e.type === "INVALID_ENCODING" ||
      e.type === "BOM_DETECTED" ||
      e.type === "UNCLOSED_CODE_FENCE"
  );
  if (hasStructural) return EXIT_CODES.STRUCTURAL_FAILURE;

  // Drift (warnings only, no errors) → check warnings
  const hasDriftWarnings = result.warnings.some(
    (e) =>
      e.type === "FINGERPRINT_DELTA" ||
      e.type === "ENTRY_POINT_DRIFT" ||
      e.type === "TEST_COMMAND_DRIFT" ||
      e.type === "UNCOVERED_DIRECTORY" ||
      e.type === "DEPENDENCY_DRIFT"
  );
  if (hasDriftWarnings) return EXIT_CODES.DRIFT_DETECTED;

  return EXIT_CODES.GENERAL_ERROR;
}

export type { ValidationError };
