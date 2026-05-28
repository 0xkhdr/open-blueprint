import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import type { Fingerprint } from "../detector/fingerprint.js";
import type { BackendManifest } from "../templater/selector.js";
import { loadCache, saveCache } from "./cache.js";
import { validateDrift } from "./drift.js";
import { validateLogical } from "./logical.js";
import { validateSemantic } from "./semantic.js";
import type { ValidationError } from "./structural.js";
import { validateStructuralBatch } from "./structural.js";
import {
  validateSettings,
  validateCommands,
  validateMCPServers,
  validateIdentity,
  validateAudit,
  validateCompliance,
  validateRisk,
  validateRegistry,
  validateOrchestration,
} from "./layers.js";
import { ClaudeAdapter } from "../translator/adapters/claude.js";
import { CursorAdapter } from "../translator/adapters/cursor.js";
import { GenericAdapter } from "../translator/adapters/generic.js";
import { CodexAdapter } from "../translator/adapters/codex.js";
import { PIAdapter } from "../translator/adapters/pi.js";
import { CopilotAdapter } from "../translator/adapters/copilot.js";
import { GeminiAdapter } from "../translator/adapters/gemini.js";
import { KiroAdapter } from "../translator/adapters/kiro.js";
import { AntigravityAdapter } from "../translator/adapters/antigravity.js";
import { validateRBAC } from "./rbac.js";

export type ValidationLevel = "structural" | "semantic" | "logical" | "drift" | "governance" | "all";

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

async function validateGovernance(
  projectRoot: string,
  manifest: BackendManifest
): Promise<ValidationError[]> {
  try {
    const adapter = getAdapterByName(manifest.backend);
    const ir = await adapter.parse(projectRoot);

    const errors: ValidationError[] = [];
    const blueprintFile = manifest.file_patterns.anchor[0]
      ? path.join(projectRoot, manifest.file_patterns.anchor[0])
      : path.join(projectRoot, ".claude", "blueprint.json");

    // Validate each enterprise layer
    if (ir.settings) {
      const settingsErrors = validateSettings(ir.settings);
      errors.push(
        ...settingsErrors.map((e) => ({
          file: blueprintFile,
          type: "GOVERNANCE_SETTINGS_INVALID",
          severity: "error" as const,
          message: `Settings layer: ${e.message}`,
          resolution: `Fix settings configuration at ${e.field || "root"}`,
        }))
      );
    }

    if (ir.commands && ir.commands.length > 0) {
      const commandErrors = validateCommands(ir.commands);
      errors.push(
        ...commandErrors.map((e) => ({
          file: blueprintFile,
          type: "GOVERNANCE_COMMANDS_INVALID",
          severity: "error" as const,
          message: `Commands layer: ${e.message}`,
          resolution: `Fix commands configuration at ${e.field || "root"}`,
        }))
      );
    }

    if (ir.mcp_servers && ir.mcp_servers.length > 0) {
      const mcpErrors = validateMCPServers(ir.mcp_servers);
      errors.push(
        ...mcpErrors.map((e) => ({
          file: blueprintFile,
          type: "GOVERNANCE_MCP_INVALID",
          severity: "error" as const,
          message: `MCP servers layer: ${e.message}`,
          resolution: `Fix MCP server configuration at ${e.field || "root"}`,
        }))
      );
    }

    if (ir.identity !== undefined) {
      const identityErrors = validateIdentity(ir.identity);
      errors.push(
        ...identityErrors.map((e) => ({
          file: blueprintFile,
          type: "GOVERNANCE_IDENTITY_INVALID",
          severity: "error" as const,
          message: `Identity layer: ${e.message}`,
          resolution: `Fix identity configuration at ${e.field || "root"}`,
        }))
      );

      const rbacErrors = validateRBAC({ identity: ir.identity }, blueprintFile);
      errors.push(...rbacErrors);
    }

    if (ir.audit) {
      const auditErrors = validateAudit(ir.audit);
      errors.push(
        ...auditErrors.map((e) => ({
          file: blueprintFile,
          type: "GOVERNANCE_AUDIT_INVALID",
          severity: "error" as const,
          message: `Audit layer: ${e.message}`,
          resolution: `Fix audit configuration at ${e.field || "root"}`,
        }))
      );
    }

    if (ir.compliance) {
      const complianceErrors = validateCompliance(ir.compliance);
      errors.push(
        ...complianceErrors.map((e) => ({
          file: blueprintFile,
          type: "GOVERNANCE_COMPLIANCE_INVALID",
          severity: "error" as const,
          message: `Compliance layer: ${e.message}`,
          resolution: `Fix compliance configuration at ${e.field || "root"}`,
        }))
      );
    }

    if (ir.risk) {
      const riskErrors = validateRisk(ir.risk);
      errors.push(
        ...riskErrors.map((e) => ({
          file: blueprintFile,
          type: "GOVERNANCE_RISK_INVALID",
          severity: "error" as const,
          message: `Risk layer: ${e.message}`,
          resolution: `Fix risk configuration at ${e.field || "root"}`,
        }))
      );
    }

    if (ir.registry) {
      const registryErrors = validateRegistry(ir.registry);
      errors.push(
        ...registryErrors.map((e) => ({
          file: blueprintFile,
          type: "GOVERNANCE_REGISTRY_INVALID",
          severity: "error" as const,
          message: `Registry layer: ${e.message}`,
          resolution: `Fix registry configuration at ${e.field || "root"}`,
        }))
      );
    }

    if (ir.orchestration) {
      const orchestrationErrors = validateOrchestration(ir.orchestration);
      errors.push(
        ...orchestrationErrors.map((e) => ({
          file: blueprintFile,
          type: "GOVERNANCE_ORCHESTRATION_INVALID",
          severity: "error" as const,
          message: `Orchestration layer: ${e.message}`,
          resolution: `Fix orchestration configuration at ${e.field || "root"}`,
        }))
      );
    }

    return errors;
  } catch (err) {
    return [
      {
        file: path.join(projectRoot, ".claude", "blueprint.json"),
        type: "GOVERNANCE_PARSE_ERROR",
        severity: "error",
        message: `Failed to parse blueprint for governance validation: ${String(err)}`,
        resolution: "Ensure blueprint is valid JSON/YAML and conforms to IR schema",
      },
    ];
  }
}

function getAdapterByName(backend: string) {
  switch (backend) {
    case "claude":
      return new ClaudeAdapter();
    case "cursor":
      return new CursorAdapter();
    case "codex":
      return new CodexAdapter();
    case "pi":
      return new PIAdapter();
    case "copilot":
      return new CopilotAdapter();
    case "gemini":
      return new GeminiAdapter();
    case "kiro":
      return new KiroAdapter();
    case "antigravity":
      return new AntigravityAdapter();
    default:
      return new GenericAdapter();
  }
}

export async function runValidator(options: ValidatorOptions): Promise<ValidationResult> {
  const { level, projectRoot, manifest, fingerprint } = options;

  const files = await collectBlueprintFiles(projectRoot, manifest);
  const cache = loadCache(projectRoot, manifest.version);
  const cacheUpdatedFiles: Record<string, { mtime: number; errors: ValidationError[] }> = {
    ...cache.files,
  };

  const filesToValidate: string[] = [];
  const cachedErrors: ValidationError[] = [];

  for (const file of files) {
    if (!fs.existsSync(file)) {
      filesToValidate.push(file);
      continue;
    }
    const stat = fs.statSync(file);
    const mtime = stat.mtimeMs;
    const cachedEntry = cache.files[file];
    if (cachedEntry && cachedEntry.mtime === mtime) {
      cachedErrors.push(...cachedEntry.errors);
    } else {
      filesToValidate.push(file);
    }
  }

  const newErrors: ValidationError[] = [];

  // Layer 1: Structural (always run for modified/new files)
  const structuralErrors = validateStructuralBatch(filesToValidate, manifest);
  newErrors.push(...structuralErrors);

  // Short-circuit: if structural hard failures exist, skip deeper layers
  const structuralHardFail = structuralErrors.some((e) => e.severity === "error");

  // Layer 2: Semantic (run only for modified/new files)
  if (!structuralHardFail && (level === "semantic" || level === "all")) {
    const semanticErrors = await validateSemantic(filesToValidate, { projectRoot, manifest });
    newErrors.push(...semanticErrors);
  }

  // Update cache for the validated files
  for (const file of filesToValidate) {
    if (!fs.existsSync(file)) continue;
    const stat = fs.statSync(file);
    // Find all errors for this specific file
    const fileErrors = newErrors.filter((e) => e.file === file);
    cacheUpdatedFiles[file] = {
      mtime: stat.mtimeMs,
      errors: fileErrors,
    };
  }

  // Save the updated cache
  saveCache(projectRoot, {
    version: "1.0",
    manifestVersion: manifest.version,
    files: cacheUpdatedFiles,
  });

  const allErrors: ValidationError[] = [...cachedErrors, ...newErrors];

  // Layer 3: Logical (always run since it is global across rules)
  if (!structuralHardFail && (level === "logical" || level === "all")) {
    const logicalErrors = await validateLogical(files, { projectRoot });
    allErrors.push(...logicalErrors);
  }

  // Layer 4: Drift (always run since it checks drift)
  if (level === "drift" || level === "all") {
    if (fingerprint) {
      const driftErrors = await validateDrift(files, {
        projectRoot,
        currentFingerprint: fingerprint,
      });
      allErrors.push(...driftErrors);
    }
  }

  // Layer 5: Governance (enterprise validation)
  if (level === "governance" || level === "all") {
    const governanceErrors = await validateGovernance(projectRoot, manifest);
    allErrors.push(...governanceErrors);
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
  if (result.passed) {
    const hasDriftWarnings = result.warnings.some(
      (e) =>
        e.type === "FINGERPRINT_DELTA" ||
        e.type === "ENTRY_POINT_DRIFT" ||
        e.type === "TEST_COMMAND_DRIFT" ||
        e.type === "UNCOVERED_DIRECTORY" ||
        e.type === "DEPENDENCY_DRIFT"
    );
    if (hasDriftWarnings) return EXIT_CODES.DRIFT_DETECTED;
    return EXIT_CODES.SUCCESS;
  }

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
