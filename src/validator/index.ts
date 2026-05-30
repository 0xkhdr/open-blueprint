import * as crypto from "node:crypto";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";
import { EXIT_CODES } from "../constants.js";
import type { Fingerprint } from "../detector/fingerprint.js";
import type { BackendManifest } from "../templater/selector.js";
import { getRegisteredAdapter } from "../translator/adapters/registry.js";
import { validateAlertingConfig } from "./alerting.js";
import { loadCacheAsync, saveCacheAsync } from "./cache.js";
import { validateCostConfig } from "./cost.js";
import { validateCrossLayerReferences } from "./cross-layer.js";
import { validateDrift } from "./drift.js";
import {
  validateAudit,
  validateCommands,
  validateCompliance,
  validateIdentity,
  validateMCPServers,
  validateOrchestration,
  validateRegistry,
  validateRisk,
  validateSettings,
} from "./layers.js";
import {
  validateCommandsDeep,
  validateMCPServersDeep,
  validateSettingsDeep,
} from "./layers-deep.js";
import { validateLogical } from "./logical.js";
import { validateOrchestrationSemantic } from "./orchestration.js";
import { auditPerformance } from "./performance.js";
import { validateRBAC } from "./rbac.js";
import { runBackendRules } from "./rules/backend-rules.js";
import { validateSemantic } from "./semantic.js";
import type { ValidationError } from "./structural.js";
import { validateStructuralBatch } from "./structural.js";

export type ValidationLevel =
  | "structural"
  | "semantic"
  | "logical"
  | "drift"
  | "governance"
  | "all";

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

export { EXIT_CODES };

function mapLayerErrors(
  layerName: string,
  rawErrors: Array<{ message: string; field?: string }>,
  blueprintFile: string
): ValidationError[] {
  const type = `GOVERNANCE_${layerName.toUpperCase().replace(/\s+/g, "_")}_INVALID`;
  return rawErrors.map((e) => ({
    file: blueprintFile,
    type,
    severity: "error" as const,
    message: `${layerName} layer: ${e.message}`,
    resolution: `Fix ${layerName.toLowerCase()} configuration at ${e.field || "root"}`,
  }));
}

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
      errors.push(...mapLayerErrors("settings", validateSettings(ir.settings), blueprintFile));
    }

    if (ir.commands && ir.commands.length > 0) {
      errors.push(...mapLayerErrors("commands", validateCommands(ir.commands), blueprintFile));
    }

    if (ir.mcp_servers && ir.mcp_servers.length > 0) {
      errors.push(
        ...mapLayerErrors("mcp servers", validateMCPServers(ir.mcp_servers), blueprintFile)
      );
    }

    if (ir.identity !== undefined) {
      errors.push(...mapLayerErrors("identity", validateIdentity(ir.identity), blueprintFile));
      const rbacErrors = validateRBAC({ identity: ir.identity }, blueprintFile);
      errors.push(...rbacErrors);
    }

    if (ir.audit) {
      errors.push(...mapLayerErrors("audit", validateAudit(ir.audit), blueprintFile));
    }

    if (ir.compliance) {
      errors.push(
        ...mapLayerErrors("compliance", validateCompliance(ir.compliance), blueprintFile)
      );
    }

    if (ir.risk) {
      errors.push(...mapLayerErrors("risk", validateRisk(ir.risk), blueprintFile));
    }

    if (ir.registry) {
      errors.push(...mapLayerErrors("registry", validateRegistry(ir.registry), blueprintFile));
    }

    if (ir.orchestration) {
      errors.push(
        ...mapLayerErrors("orchestration", validateOrchestration(ir.orchestration), blueprintFile)
      );
    }

    // Semantic orchestration + cross-layer validation (always runs in governance mode)
    {
      const orchestrationSemanticErrors = validateOrchestrationSemantic(ir);
      errors.push(...orchestrationSemanticErrors);
    }

    // Cross-layer reference validation
    {
      const crossLayerErrors = validateCrossLayerReferences(ir, blueprintFile);
      errors.push(...crossLayerErrors);
    }

    // Layer 6-8 deep validation
    {
      const settingsDeepErrors = validateSettingsDeep(ir, blueprintFile);
      errors.push(...settingsDeepErrors);
    }
    {
      const commandsDeepErrors = validateCommandsDeep(ir, blueprintFile);
      errors.push(...commandsDeepErrors);
    }
    {
      const mcpDeepErrors = validateMCPServersDeep(ir, blueprintFile);
      errors.push(...mcpDeepErrors);
    }

    // Performance audit
    {
      const perfResult = auditPerformance(ir, blueprintFile);
      errors.push(...perfResult.warnings);
    }

    // Phase 4: Observability & Cost validation
    if (ir.cost) {
      const costErrors = validateCostConfig(ir);
      errors.push(...costErrors);
    }

    if (ir.alerting) {
      const alertingErrors = validateAlertingConfig(ir);
      errors.push(...alertingErrors);
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
  return getRegisteredAdapter(backend);
}

async function computeContentHash(filePath: string): Promise<string> {
  const content = await fsPromises.readFile(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function runValidator(options: ValidatorOptions): Promise<ValidationResult> {
  const { level, projectRoot, manifest, fingerprint } = options;

  const files = await collectBlueprintFiles(projectRoot, manifest);
  const cache = await loadCacheAsync(projectRoot, manifest.version);
  const cacheUpdatedFiles: Record<
    string,
    { mtime: number; contentHash: string; errors: ValidationError[] }
  > = { ...cache.files };

  const filesToValidate: string[] = [];
  const cachedErrors: ValidationError[] = [];

  await Promise.all(
    files.map(async (file) => {
      let stat;
      try {
        stat = await fsPromises.stat(file);
      } catch {
        filesToValidate.push(file);
        return;
      }
      const mtime = stat.mtimeMs;
      const cachedEntry = cache.files[file];
      if (!cachedEntry) {
        filesToValidate.push(file);
        return;
      }
      if (cachedEntry.mtime === mtime) {
        cachedErrors.push(...cachedEntry.errors);
        return;
      }
      const contentHash = await computeContentHash(file);
      if (cachedEntry.contentHash === contentHash) {
        cacheUpdatedFiles[file] = { ...cachedEntry, mtime };
        cachedErrors.push(...cachedEntry.errors);
      } else {
        filesToValidate.push(file);
      }
    })
  );

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
  await Promise.all(
    filesToValidate.map(async (file) => {
      let stat;
      try {
        stat = await fsPromises.stat(file);
      } catch {
        return;
      }
      const contentHash = await computeContentHash(file);
      const fileErrors = newErrors.filter((e) => e.file === file);
      cacheUpdatedFiles[file] = { mtime: stat.mtimeMs, contentHash, errors: fileErrors };
    })
  );

  // Save the updated cache
  await saveCacheAsync(projectRoot, {
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

  // Backend-specific validation rules (only when .bp.json is present)
  if (level === "logical" || level === "all") {
    const { loadProjectConfig } = await import("../config/project.js");
    const projectConfig = loadProjectConfig(projectRoot);
    if (projectConfig) {
      const backends =
        projectConfig.backends ?? (projectConfig.backend ? [projectConfig.backend] : []);
      if (backends.length > 0) {
        const backendErrors = runBackendRules(projectRoot, backends);
        allErrors.push(...backendErrors);
      }
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
      e.type === "UNKNOWN_TOOL_REFERENCE" ||
      e.type === "UNKNOWN_COMMAND_REFERENCE" ||
      e.type === "DUPLICATE_COMMAND" ||
      e.type === "INVALID_BUDGET" ||
      e.type === "MCP_SERVER_INCOMPLETE"
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
