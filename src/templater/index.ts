import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import { loadProjectConfig } from "../config/project.js";
import type { Fingerprint } from "../detector/fingerprint.js";
import { enrichFingerprint } from "../detector/index.js";
import { logger } from "../logger.js";
import { RegistryClient } from "../registry/client.js";
import { normalizeError } from "../utils/errors.js";
import { type RenderContext, shouldRenderTemplate } from "./conditional.js";
import { registerPartials } from "./engine.js";
import { TemplateVarsValidationError } from "./errors.js";
import { hasTemplateMetadata, parseTemplateMetadata, stripMetadata } from "./metadata.js";
import { renderFromRegistry } from "./registry.js";
import { mergeRiskTemplates, resolveRiskTemplatePack } from "./risk-selector.js";
import { getTemplatesRoot, resolveTemplatePack } from "./selector.js";
import type { WriteResult } from "./writer.js";
import { writeFile } from "./writer.js";

export interface TemplaterOptions {
  backend: string;
  templateOverride?: string | undefined;
  dryRun?: boolean | undefined;
  force?: boolean | undefined;
  verbose?: boolean | undefined;
  vars?: Record<string, unknown> | undefined;
}

// Shell metacharacters that could enable injection if not sanitized
const SHELL_META_RE = /[;&|`$(){}[\]<>\\!#~]/g;

const BLOCKED_HBS_KEYS = new Set(["if", "unless", "each", "with", "lookup", "log"]);
const MAX_STRING_LENGTH = 10_000;
const MAX_DEPTH = 5;

function checkDepth(value: unknown, depth: number, path: string, issues: string[]): void {
  if (depth > MAX_DEPTH) {
    issues.push(`${path}: nesting depth exceeds limit of ${MAX_DEPTH}`);
    return;
  }
  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    issues.push(`${path}: string length ${value.length} exceeds limit of ${MAX_STRING_LENGTH}`);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      checkDepth(v, depth + 1, `${path}.${k}`, issues);
    }
  }
}

const VarsSchema = z.record(z.string(), z.unknown()).superRefine((vars, ctx) => {
  for (const key of Object.keys(vars)) {
    if (BLOCKED_HBS_KEYS.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Key "${key}" is a reserved Handlebars helper name`,
        path: [key],
      });
    }
  }
  const issues: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    checkDepth(value, 1, key, issues);
  }
  for (const issue of issues) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue });
  }
});

export function sanitizeTemplateVars(vars: Record<string, unknown>): Record<string, unknown> {
  const result = VarsSchema.safeParse(vars);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.message);
    throw new TemplateVarsValidationError(
      `Template vars validation failed: ${fields.join("; ")}`,
      fields
    );
  }
  // Strip prototype chain before deepFreeze
  const stripped = JSON.parse(JSON.stringify(result.data)) as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stripped)) {
    if (typeof value === "string") {
      sanitized[key] = value.replace(SHELL_META_RE, "");
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface TemplaterResult {
  files: WriteResult[];
  templatePack: string;
}

export interface TemplateContext {
  project_name: string;
  project_type: string;
  primary_language: string;
  primary_framework: string;
  entry_point_path: string;
  test_command: string;
  test_runner: string;
  package_manager: string;
  build_tool: string;
  linter: string;
  ci_system: string;
  git_workflow: string;
  has_auth: boolean;
  has_external_apis: boolean;
  has_docker: boolean;
  languages: Array<{ name: string; confidence: number; primary: boolean }>;
  frameworks: Array<{ name: string; confidence: number }>;
  detected_at: string;
  src_dirs: string[];
  test_dirs: string[];
  // Layer 6-8 support: context for conditional generation
  has_secrets_manager?: boolean;
  risk_tier?: "low" | "medium" | "high" | "critical";
  approval_mode?: "auto" | "confirm" | "read-only";
  estimated_monthly_tokens?: number;
}

const BP_VERSION = "1.0.0";

function buildContext(fingerprint: Fingerprint): TemplateContext {
  const primaryLang = fingerprint.languages.find((l) => l.primary);
  const topFramework = fingerprint.frameworks[0];
  const firstEntry = fingerprint.entry_points[0];
  const enhanced = fingerprint as Fingerprint & {
    risk_tier?: "low" | "medium" | "high" | "critical";
  };
  const riskTier = enhanced.risk_tier ?? enrichFingerprint(fingerprint).risk_tier ?? "low";

  return {
    project_name: fingerprint.project.name,
    project_type: fingerprint.project.type,
    primary_language: primaryLang?.name ?? "unknown",
    primary_framework: topFramework?.name ?? "none",
    entry_point_path: firstEntry?.path ?? "src/index.ts",
    test_command: fingerprint.tooling.test_command ?? "npm test",
    test_runner: fingerprint.tooling.test_runner ?? "unknown",
    package_manager: fingerprint.tooling.package_manager ?? "npm",
    build_tool: fingerprint.tooling.build_tool ?? "none",
    linter: fingerprint.tooling.linter ?? "none",
    ci_system: fingerprint.tooling.ci_system ?? "none",
    git_workflow: fingerprint.project.git_workflow,
    has_auth: fingerprint.security_signals.has_auth,
    has_external_apis: fingerprint.security_signals.has_external_apis,
    has_docker: fingerprint.security_signals.has_docker,
    languages: fingerprint.languages,
    frameworks: fingerprint.frameworks,
    detected_at: fingerprint.detected_at,
    src_dirs: fingerprint.directory_topology.src_dirs,
    test_dirs: fingerprint.directory_topology.test_dirs,
    risk_tier: riskTier,
  };
}

async function findTemplateFiles(templateDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    try {
      await fsPromises.access(dir);
    } catch {
      return;
    }
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".hbs")) {
        files.push(fullPath);
      }
    }
  }

  await walk(templateDir);
  return files;
}

function getOutputPath(templatePath: string, templateDir: string, projectRoot: string): string {
  const relative = path.relative(templateDir, templatePath);
  // Remove .hbs extension
  const withoutHbs = relative.replace(/\.hbs$/, "");
  return path.join(projectRoot, withoutHbs);
}

export async function runTemplater(
  fingerprint: Fingerprint,
  projectRoot: string,
  options: TemplaterOptions & { isExtendedRun?: boolean }
): Promise<TemplaterResult> {
  const {
    backend,
    templateOverride,
    dryRun = false,
    force = false,
    verbose = false,
    isExtendedRun = false,
    vars,
  } = options;

  // Register base partials
  const basePartialsDir = path.join(getTemplatesRoot(), "_base", "partials");
  await registerPartials(basePartialsDir);

  const results: WriteResult[] = [];
  let basePackName = "";

  // 1. Resolve blueprint inheritance first
  if (!isExtendedRun && !templateOverride) {
    const projectConfig = loadProjectConfig(projectRoot);
    if (projectConfig?.extends) {
      const registry = new RegistryClient();
      const baseDir = path.join(os.homedir(), ".bp", "templates", projectConfig.extends);
      try {
        await registry.install(projectConfig.extends, baseDir);
        const baseResult = await runTemplater(fingerprint, projectRoot, {
          backend,
          templateOverride: baseDir,
          dryRun,
          force,
          isExtendedRun: true,
        });
        results.push(...baseResult.files);
        basePackName = baseResult.templatePack;
      } catch (e) {
        logger.warn(
          { extends: projectConfig.extends, err: normalizeError(e).message },
          "Could not resolve extended template"
        );
      }
    }
  }

  const pack = resolveTemplatePack(fingerprint, backend, templateOverride);
  const ctx = buildContext(fingerprint);
  const sanitizedVars = vars ? sanitizeTemplateVars(vars) : {};
  const context = { ...(ctx as unknown as Record<string, unknown>), ...(sanitizedVars as Record<string, unknown>) };

  const baseFiles = await findTemplateFiles(pack.directory);
  const riskTier = ctx.risk_tier ?? "low";
  const riskDir = resolveRiskTemplatePack(pack.directory, riskTier);
  const riskFiles = riskDir ? await findTemplateFiles(riskDir) : [];
  const templateFiles = mergeRiskTemplates(baseFiles, riskFiles);

  const renderCtx: RenderContext = {
    risk_tier: riskTier,
    primary_language: ctx.primary_language,
    primary_framework: ctx.primary_framework,
    project_type: ctx.project_type,
    backend_manifest: pack.manifest,
    bp_version: BP_VERSION,
  };

  for (const templateFile of templateFiles) {
    if (path.basename(templateFile) === "manifest.json.hbs") continue;

    const meta = parseTemplateMetadata(templateFile);
    const check = shouldRenderTemplate(meta, renderCtx);
    if (!check.render) {
      if (verbose) {
        logger.debug(
          { file: path.relative(pack.directory, templateFile), reason: check.reason },
          "Skipping template"
        );
      }
      continue;
    }

    const templateName = path.relative(pack.directory, templateFile);
    const raw = await fsPromises.readFile(templateFile, "utf-8");
    const source = hasTemplateMetadata(meta) ? stripMetadata(raw) : raw;
    const rendered = renderFromRegistry(
      backend,
      pack.name,
      templateName,
      source,
      context as Record<string, unknown>
    );

    // Determine output base dir: risk files map to projectRoot directly
    const baseDir = riskFiles.includes(templateFile) && riskDir ? riskDir : pack.directory;
    const outputPath = getOutputPath(templateFile, baseDir, projectRoot);

    const result = await writeFile(outputPath, rendered, {
      dryRun,
      force,
      projectRoot,
    });

    results.push(result);
  }

  // Write .blueprintignore if not exists
  const ignoreFile = path.join(projectRoot, ".blueprintignore");
  if (!isExtendedRun && !dryRun) {
    try {
      await fsPromises.access(ignoreFile);
    } catch {
      await fsPromises.writeFile(
        ignoreFile,
        "# Files and directories bp will not overwrite\n# Add paths relative to project root\n",
        "utf-8"
      );
    }
  }

  // Write .bp-fingerprint.json
  const fingerprintFile = path.join(projectRoot, ".bp-fingerprint.json");
  if (!isExtendedRun && !dryRun) {
    await fsPromises.writeFile(fingerprintFile, JSON.stringify(fingerprint, null, 2), "utf-8");
  }

  return {
    files: results,
    templatePack: basePackName ? `${basePackName} -> ${pack.name}` : pack.name,
  };
}
