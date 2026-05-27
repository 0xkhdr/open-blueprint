import * as path from "node:path";
import fg from "fast-glob";
import type { BackendManifest } from "../templater/selector.js";
import type { ValidationError } from "./structural.js";
import { validateStructuralBatch } from "./structural.js";

export type ValidationLevel = "structural" | "semantic" | "logical" | "drift" | "all";

export interface ValidatorOptions {
  level: ValidationLevel;
  projectRoot: string;
  manifest: BackendManifest;
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
  const { level, projectRoot, manifest } = options;

  const files = await collectBlueprintFiles(projectRoot, manifest);

  const allErrors: ValidationError[] = [];

  // Layer 1: Structural (always run)
  const structuralErrors = validateStructuralBatch(files, manifest);
  allErrors.push(...structuralErrors);

  // Additional layers are stubs for Phase 1; Phase 2 fills them in
  if (level === "semantic" || level === "all") {
    // Phase 2: semantic validation
  }

  if (level === "logical" || level === "all") {
    // Phase 2: logical validation
  }

  if (level === "drift" || level === "all") {
    // Phase 2: drift detection
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
  return EXIT_CODES.GENERAL_ERROR;
}

export type { ValidationError };
