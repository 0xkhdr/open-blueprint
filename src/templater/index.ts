import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadProjectConfig } from "../config/project.js";
import type { Fingerprint } from "../detector/fingerprint.js";
import { RegistryClient } from "../registry/client.js";
import { registerPartials, renderTemplate } from "./engine.js";
import { getTemplatesRoot, resolveTemplatePack } from "./selector.js";
import type { WriteResult } from "./writer.js";
import { writeFile } from "./writer.js";

export interface TemplaterOptions {
  backend: string;
  templateOverride?: string | undefined;
  dryRun?: boolean | undefined;
  force?: boolean | undefined;
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
}

function buildContext(fingerprint: Fingerprint): TemplateContext {
  const primaryLang = fingerprint.languages.find((l) => l.primary);
  const topFramework = fingerprint.frameworks[0];
  const firstEntry = fingerprint.entry_points[0];

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
  const context = buildContext(fingerprint) as unknown as Record<string, unknown>;

  const templateFiles = findTemplateFiles(pack.directory);

  for (const templateFile of templateFiles) {
    // Skip manifest.json.hbs if it exists
    if (path.basename(templateFile) === "manifest.json.hbs") continue;

    const rendered = renderTemplate(templateFile, context);
    const outputPath = getOutputPath(templateFile, pack.directory, projectRoot);

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
