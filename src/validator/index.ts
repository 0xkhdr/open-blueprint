/**
 * Validation pipeline (Stage 2 SOLID refactor).
 *
 * This file is a thin composer: it owns file collection, resource limits,
 * the per-file result cache, the timeout, and severity partitioning. The six
 * validation levels live in `levels/` behind the `LevelValidator` contract
 * and are assembled by `levels/registry.ts`; cross-layer services (blueprint
 * parsing, plugin running) are injected (`contracts.ts`, default wiring in
 * `default-wiring.ts`).
 */

import * as crypto from "node:crypto";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";
import { EXIT_CODES } from "../constants.js";
import { logger as defaultLogger } from "../logger.js";
import { startSpan } from "../telemetry/tracer.js";
import type { BackendManifest } from "../templater/selector.js";
import type { ILogger } from "../types/logger.js";
import type { ValidationError } from "../types/validation.js";
import { loadCacheAsync, saveCacheAsync } from "./cache.js";
import type {
  LevelValidator,
  ValidationContext,
  ValidationLevel,
  ValidationResult,
  ValidatorOptions,
  ValidatorServices,
} from "./contracts.js";
import { resolveServices } from "./default-wiring.js";
import type { EnforcementSummary } from "./enforcement.js";
import { ResourceLimitError, ValidationTimeoutError } from "./errors.js";
import { createDefaultLevels } from "./levels/registry.js";

export const MAX_VALIDATION_FILES = Number(process.env.BP_MAX_VALIDATION_FILES ?? 1000);
export const MAX_VALIDATION_BYTES = Number(process.env.BP_MAX_VALIDATION_BYTES ?? 52_428_800);
export const VALIDATION_TIMEOUT_MS = Number(process.env.BP_VALIDATION_TIMEOUT_MS ?? 30_000);

export type {
  BlueprintSource,
  LevelOutcome,
  LevelValidator,
  PluginEngine,
  ValidationContext,
  ValidationLevel,
  ValidationResult,
  ValidatorOptions,
  ValidatorServices,
} from "./contracts.js";
export { createDefaultLevels } from "./levels/registry.js";

export { EXIT_CODES };

export async function collectBlueprintFiles(
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

async function computeContentHash(filePath: string): Promise<string> {
  const content = await fsPromises.readFile(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Composes the registered levels into one run. Constructor injection only —
 * levels, services, and logger all have default wiring supplied by
 * `runValidator`, so tests and orchestrators can substitute any of them.
 */
export class ValidationPipeline {
  private readonly levels: LevelValidator[];
  private readonly services: ValidatorServices;
  private readonly logger: ILogger;

  constructor(options?: {
    levels?: LevelValidator[];
    services?: Partial<ValidatorServices>;
    logger?: ILogger;
  }) {
    this.services = resolveServices(options?.services);
    this.levels = options?.levels ?? createDefaultLevels(this.services);
    this.logger = options?.logger ?? defaultLogger;
  }

  async run(options: ValidatorOptions): Promise<ValidationResult> {
    const { level, projectRoot, manifest, fingerprint } = options;

    const files = await collectBlueprintFiles(projectRoot, manifest);

    // Pre-validation file count check
    if (files.length > MAX_VALIDATION_FILES) {
      throw new ResourceLimitError(
        `File count ${files.length} exceeds limit ${MAX_VALIDATION_FILES}`,
        files.length,
        MAX_VALIDATION_FILES
      );
    }

    // Pre-validation total byte size check
    const sizes = await Promise.all(
      files.map(async (f) => {
        try {
          const stat = await fsPromises.stat(f);
          return stat.size;
        } catch {
          return 0;
        }
      })
    );
    const totalBytes = sizes.reduce((a, b) => a + b, 0);
    if (totalBytes > MAX_VALIDATION_BYTES) {
      throw new ResourceLimitError(
        `Total size ${totalBytes} bytes exceeds limit ${MAX_VALIDATION_BYTES} bytes`,
        totalBytes,
        MAX_VALIDATION_BYTES
      );
    }

    // Scan mode is part of the cache identity: entropy on/off changes per-file
    // findings, so cached results from one mode must not serve the other.
    const cacheKey = `${manifest.version}:entropy=${options.entropyScan ? 1 : 0}`;
    const cache = await loadCacheAsync(projectRoot, cacheKey);
    const cacheUpdatedFiles: Record<
      string,
      { mtime: number; contentHash: string; errors: ValidationError[] }
    > = { ...cache.files };

    const filesToValidate: string[] = [];
    const cachedErrors: ValidationError[] = [];

    await Promise.all(
      files.map(async (file) => {
        let stat: Awaited<ReturnType<typeof fsPromises.stat>> | undefined;
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

    const ctx: ValidationContext = {
      projectRoot,
      manifest,
      fingerprint,
      options,
      files,
      filesToValidate,
      structuralFailed: false,
    };

    // Phase 1: file-scoped levels (results feed the per-file cache)
    const newErrors: ValidationError[] = [];
    for (const lvl of this.levels) {
      if (!lvl.runFileScoped || !lvl.enabledFor(level)) continue;
      if (lvl.skipOnStructuralFailure && ctx.structuralFailed) continue;
      const levelErrors = await lvl.runFileScoped(ctx);
      newErrors.push(...levelErrors);
      if (lvl.marksStructuralFailure) {
        ctx.structuralFailed = levelErrors.some((e) => e.severity === "error");
      }
    }

    // Update cache for the validated files
    await Promise.all(
      filesToValidate.map(async (file) => {
        let stat: Awaited<ReturnType<typeof fsPromises.stat>> | undefined;
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

    await saveCacheAsync(projectRoot, {
      version: "1.0",
      manifestVersion: cacheKey,
      files: cacheUpdatedFiles,
    });

    const allErrors: ValidationError[] = [...cachedErrors, ...newErrors];

    // Phase 2: global levels (cross-file checks that bypass the cache)
    let enforcementSummary: EnforcementSummary | undefined;
    for (const lvl of this.levels) {
      if (!lvl.runGlobal || !lvl.enabledFor(level)) continue;
      if (lvl.skipOnStructuralFailure && ctx.structuralFailed) continue;
      const outcome = await lvl.runGlobal(ctx);
      allErrors.push(...outcome.errors);
      if (outcome.enforcement) enforcementSummary = outcome.enforcement;
    }

    // Phase 3: plugin validators run against the parsed IR + file inventory
    if (!ctx.structuralFailed && !options.noPlugins) {
      allErrors.push(...(await this.services.pluginEngine.run(ctx)));
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
      ...(enforcementSummary ? { enforcement: enforcementSummary } : {}),
    };
  }

  /** Pipeline run wrapped in the validation timeout and root telemetry span. */
  async runWithTimeout(options: ValidatorOptions): Promise<ValidationResult> {
    const startMs = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) => {
      const t = setTimeout(() => {
        const elapsedMs = Date.now() - startMs;
        const err = new ValidationTimeoutError(elapsedMs, VALIDATION_TIMEOUT_MS);
        this.logger.warn({ elapsedMs, timeoutMs: VALIDATION_TIMEOUT_MS }, "Validation timed out");
        reject(err);
      }, VALIDATION_TIMEOUT_MS);
      if (typeof t === "object" && "unref" in t) t.unref();
    });

    return startSpan("bp.validate", (span) => {
      span.setAttribute("level", options.level);
      return Promise.race([this.run(options), timeoutPromise]);
    });
  }
}

export async function runValidator(options: ValidatorOptions): Promise<ValidationResult> {
  const pipeline = new ValidationPipeline(options.services ? { services: options.services } : {});
  return pipeline.runWithTimeout(options);
}

const DRIFT_WARNING_TYPES = new Set([
  "FINGERPRINT_DELTA",
  "ENTRY_POINT_DRIFT",
  "TEST_COMMAND_DRIFT",
  "UNCOVERED_DIRECTORY",
  "DEPENDENCY_DRIFT",
  "PACK_FILE_MISSING",
  "PACK_FILE_MODIFIED",
  "PACK_DRIFTED",
]);

/**
 * Map a validation result to the public exit-code contract
 * (docs/troubleshooting.md "Exit Code Registry").
 *
 * Drift findings are warnings: a passing result exits 0 unless drift was
 * explicitly requested via `--level drift` or `--fail-on drift` — a fresh
 * scaffold must never fail its own verification by default.
 */
export function exitCodeForResult(result: ValidationResult, failOn?: ValidationLevel): number {
  const hasDriftWarnings = result.warnings.some((e) => DRIFT_WARNING_TYPES.has(e.type));

  if (result.passed) {
    if (hasDriftWarnings && (result.level === "drift" || failOn === "drift")) {
      return EXIT_CODES.DRIFT_DETECTED;
    }
    return EXIT_CODES.SUCCESS;
  }

  // Logically inconsistent rules/constraints and reference-level issues →
  // semantic validation failure (exit 5)
  const hasSemantic = result.errors.some(
    (e) =>
      e.type === "RULE_CONFLICT_HARD" ||
      e.type === "SEMANTIC_CONTRADICTION" ||
      e.type === "CIRCULAR_SKILL_DEPENDENCY" ||
      e.type === "ZERO_MATCH_SCOPE" ||
      e.type === "INVALID_SCOPE_PATTERN" ||
      e.type === "MISSING_SKILL_REFERENCE" ||
      e.type === "UNKNOWN_TOOL_REFERENCE" ||
      e.type === "UNKNOWN_COMMAND_REFERENCE" ||
      e.type === "DUPLICATE_COMMAND" ||
      e.type === "INVALID_BUDGET" ||
      e.type === "MCP_SERVER_INCOMPLETE" ||
      e.type === "SKILL_SCHEMA_INVALID" ||
      e.type === "SKILL_NAME_COLLISION" ||
      e.type === "SKILL_UNKNOWN_TOOL" ||
      e.type === "SKILL_NO_PROCEDURE"
  );
  if (hasSemantic) return EXIT_CODES.SEMANTIC_FAILURE;

  // Structural problems and failed enforcement checks → structural
  // validation failure (exit 4; the documented `bp report` CI-gate code)
  const hasStructural = result.errors.some(
    (e) =>
      e.type === "RULE_VIOLATION" ||
      e.type === "RULE_CHECK_INVALID" ||
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
