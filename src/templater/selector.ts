import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Fingerprint } from "../detector/fingerprint.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = path.resolve(__dirname, "../../templates");

export interface TemplatePack {
  name: string;
  backend: string;
  directory: string;
  manifestPath: string;
  manifest: BackendManifest;
}

export interface BackendManifest {
  backend: string;
  version: string;
  supported_features: {
    anchors: boolean;
    rules: boolean;
    skills: boolean;
    agents: boolean;
    hooks: boolean;
  };
  file_patterns: {
    anchor: string[];
    rules: string;
    skills: string;
    agents: string;
    hooks: string;
  };
  max_file_sizes: {
    anchor: number;
    rules: number;
    skills: number;
    agents: number;
  };
  frontmatter_schema: {
    rules: {
      required: string[];
      optional: string[];
      severity_values: string[];
    };
    skills: {
      required: string[];
      optional: string[];
    };
    agents: {
      required: string[];
      optional: string[];
    };
  };
}

function loadManifest(manifestPath: string): BackendManifest {
  const content = fs.readFileSync(manifestPath, "utf-8");
  return JSON.parse(content) as BackendManifest;
}

function selectTemplatePack(fingerprint: Fingerprint, backend: string): string {
  const primaryLang = fingerprint.languages.find((l) => l.primary)?.name ?? "typescript";
  const topFramework = fingerprint.frameworks[0]?.name;

  const langFrameworkMap: Record<string, Record<string, string>> = {
    typescript: {
      nextjs: "nextjs",
      nestjs: "nestjs",
      express: "express",
    },
    javascript: {
      nextjs: "nextjs",
      express: "express",
    },
    python: {
      fastapi: "fastapi",
      django: "django",
    },
    go: {
      default: "go",
    },
    rust: {
      axum: "rust-axum",
      "actix-web": "rust-axum",
    },
    java: {
      "spring-boot": "java-spring",
    },
    ruby: {
      rails: "ruby-rails",
    },
  };

  const langMap = langFrameworkMap[primaryLang];
  if (langMap && topFramework) {
    const specific = langMap[topFramework];
    const packPath = path.join(TEMPLATES_ROOT, backend, specific ?? "");
    if (specific && fs.existsSync(packPath)) return packPath;
  }

  // Language-base fallback
  const langBasePath = path.join(TEMPLATES_ROOT, backend, primaryLang);
  if (fs.existsSync(langBasePath)) return langBasePath;

  // Generic fallback
  const genericPath = path.join(TEMPLATES_ROOT, backend);
  return genericPath;
}

export function resolveTemplatePack(
  fingerprint: Fingerprint,
  backend: string,
  templateOverride?: string
): TemplatePack {
  const backendDir = templateOverride
    ? path.resolve(templateOverride)
    : selectTemplatePack(fingerprint, backend);

  const manifestPath = path.join(backendDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    // Fall back to base backend dir
    const baseManifestPath = path.join(TEMPLATES_ROOT, backend, "manifest.json");
    if (!fs.existsSync(baseManifestPath)) {
      throw new Error(
        `No manifest.json found for backend "${backend}". ` +
          `Searched: ${manifestPath}, ${baseManifestPath}`
      );
    }
    const manifest = loadManifest(baseManifestPath);
    return {
      name: backend,
      backend,
      directory: path.join(TEMPLATES_ROOT, backend),
      manifestPath: baseManifestPath,
      manifest,
    };
  }

  const manifest = loadManifest(manifestPath);
  return {
    name: path.relative(TEMPLATES_ROOT, backendDir),
    backend,
    directory: backendDir,
    manifestPath,
    manifest,
  };
}

export function getTemplatesRoot(): string {
  return TEMPLATES_ROOT;
}
