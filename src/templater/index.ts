import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadProjectConfig } from "../config/project.js";
import type { Fingerprint } from "../detector/fingerprint.js";
import { enrichFingerprint } from "../detector/index.js";
import { RegistryClient } from "../registry/client.js";
import { type RenderContext, shouldRenderTemplate } from "./conditional.js";
import { registerPartials, renderString, renderTemplate } from "./engine.js";
import { hasTemplateMetadata, parseTemplateMetadata, stripMetadata } from "./metadata.js";
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

function findTemplateFiles(templateDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".hbs")) {
        files.push(fullPath);
      }
    }
  }

  walk(templateDir);
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
  } = options;

  // Register base partials
  const basePartialsDir = path.join(getTemplatesRoot(), "_base", "partials");
  registerPartials(basePartialsDir);

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
        console.warn(
          `[extends] Could not resolve extended template "${projectConfig.extends}": ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  const pack = resolveTemplatePack(fingerprint, backend, templateOverride);
  const ctx = buildContext(fingerprint);
  const context = ctx as unknown as Record<string, unknown>;

  const baseFiles = findTemplateFiles(pack.directory);
  const riskTier = ctx.risk_tier ?? "low";
  const riskDir = resolveRiskTemplatePack(pack.directory, riskTier);
  const riskFiles = riskDir ? findTemplateFiles(riskDir) : [];
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
        console.log(
          `[templater] skip ${path.relative(pack.directory, templateFile)}: ${check.reason}`
        );
      }
      continue;
    }

    let rendered: string;
    if (hasTemplateMetadata(meta)) {
      const raw = fs.readFileSync(templateFile, "utf-8");
      rendered = renderString(stripMetadata(raw), context);
    } else {
      rendered = renderTemplate(templateFile, context);
    }

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
  if (!isExtendedRun && !fs.existsSync(ignoreFile) && !dryRun) {
    fs.writeFileSync(
      ignoreFile,
      "# Files and directories bp will not overwrite\n# Add paths relative to project root\n",
      "utf-8"
    );
  }

  // Write .bp-fingerprint.json
  const fingerprintFile = path.join(projectRoot, ".bp-fingerprint.json");
  if (!isExtendedRun && !dryRun) {
    fs.writeFileSync(fingerprintFile, JSON.stringify(fingerprint, null, 2), "utf-8");
  }

  return {
    files: results,
    templatePack: basePackName ? `${basePackName} -> ${pack.name}` : pack.name,
  };
}
