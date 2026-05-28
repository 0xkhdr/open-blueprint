import * as fs from "node:fs";
import * as path from "node:path";
import type { Fingerprint } from "./fingerprint.js";
import { FingerprintSchema } from "./fingerprint.js";
import { detectFrameworks } from "./frameworks.js";
import { detectLanguages } from "./languages.js";
import { detectSecurity } from "./security.js";
import { detectTooling } from "./tooling.js";

interface DirectoryTopology {
  src_dirs: string[];
  test_dirs: string[];
  config_dirs: string[];
  package_dirs: string[];
}

interface EntryPoint {
  path: string;
  type: "cli" | "server" | "library" | "ui";
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function detectProjectName(root: string): string {
  const pkgPath = path.join(root, "package.json");
  if (fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { name?: string };
      if (pkg.name) return pkg.name.replace(/^@[^/]+\//, "");
    } catch {
      /* fall through */
    }
  }
  return path.basename(root);
}

function detectProjectType(
  root: string
): "monorepo" | "polyrepo" | "library" | "application" | "service" {
  const isMonorepo =
    fileExists(path.join(root, "pnpm-workspace.yaml")) ||
    fileExists(path.join(root, "lerna.json")) ||
    fileExists(path.join(root, "nx.json")) ||
    fileExists(path.join(root, "turbo.json")) ||
    fileExists(path.join(root, "rush.json")) ||
    fileExists(path.join(root, "packages"));
  if (isMonorepo) return "monorepo";

  const pkgPath = path.join(root, "package.json");
  if (fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
        main?: string;
        exports?: unknown;
        private?: boolean;
        bin?: unknown;
      };
      if (pkg.bin) return "application";
      if (pkg.main || pkg.exports) return "library";
    } catch {
      /* fall through */
    }
  }

  if (
    fileExists(path.join(root, "Dockerfile")) ||
    fileExists(path.join(root, "docker-compose.yml"))
  )
    return "service";

  return "application";
}

function detectGitWorkflow(root: string): "github-flow" | "trunk-based" | "gitflow" | "unknown" {
  const ghDir = path.join(root, ".github");
  if (fileExists(ghDir)) {
    const branchProtection = path.join(ghDir, "workflows");
    if (fileExists(branchProtection)) return "github-flow";
  }
  // Check for gitflow branches in .git
  const gitHead = path.join(root, ".git", "HEAD");
  if (fileExists(gitHead)) {
    try {
      const content = fs.readFileSync(gitHead, "utf-8");
      if (content.includes("develop")) return "gitflow";
      if (content.includes("main") || content.includes("master")) return "trunk-based";
    } catch {
      /* skip */
    }
  }
  return "unknown";
}

function scanDirectoryTopology(root: string): DirectoryTopology {
  const srcNames = ["src", "lib", "app", "source"];
  const testNames = ["tests", "test", "__tests__", "spec", "specs"];
  const configNames = ["config", "configs", ".config", "settings"];
  const packageNames = ["packages", "apps", "services", "modules", "libs"];

  const src_dirs: string[] = [];
  const test_dirs: string[] = [];
  const config_dirs: string[] = [];
  const package_dirs: string[] = [];

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (srcNames.includes(name)) src_dirs.push(name);
      if (testNames.includes(name)) test_dirs.push(name);
      if (configNames.includes(name)) config_dirs.push(name);
      if (packageNames.includes(name)) package_dirs.push(name);
    }
  } catch {
    /* skip */
  }

  return { src_dirs, test_dirs, config_dirs, package_dirs };
}

function detectEntryPoints(root: string, frameworks: Array<{ name: string }>): EntryPoint[] {
  const entries: EntryPoint[] = [];

  const hasFramework = (name: string) => frameworks.some((f) => f.name === name);

  // Server entry points
  const serverFiles = [
    "src/main.ts",
    "src/index.ts",
    "src/server.ts",
    "src/app.ts",
    "main.ts",
    "index.ts",
    "server.js",
    "app.js",
    "public/index.php",
    "index.php",
    "artisan",
  ];
  for (const f of serverFiles) {
    if (fileExists(path.join(root, f))) {
      const type: "server" | "ui" | "library" | "cli" =
        hasFramework("nestjs") ||
        hasFramework("express") ||
        hasFramework("fastapi") ||
        hasFramework("laravel")
          ? "server"
          : hasFramework("nextjs") || hasFramework("react") || hasFramework("vue")
            ? "ui"
            : "library";
      entries.push({ path: f, type });
      break;
    }
  }

  // CLI entry points
  const pkgPath = path.join(root, "package.json");
  if (fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { bin?: Record<string, string> };
      if (pkg.bin && typeof pkg.bin === "object") {
        for (const binPath of Object.values(pkg.bin)) {
          entries.push({ path: binPath, type: "cli" });
        }
      }
    } catch {
      /* skip */
    }
  }

  return entries.slice(0, 5);
}

export class DetectorError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DetectorError";
  }
}

export async function detect(projectRoot: string): Promise<Fingerprint> {
  const absoluteRoot = path.resolve(projectRoot);

  if (!fileExists(absoluteRoot)) {
    throw new DetectorError(`Project root does not exist: ${absoluteRoot}`);
  }

  const [languages, frameworks, tooling, security_signals, directory_topology] = await Promise.all([
    Promise.resolve().then(() => detectLanguages(absoluteRoot)),
    Promise.resolve().then(() => detectFrameworks(absoluteRoot)),
    Promise.resolve().then(() => detectTooling(absoluteRoot)),
    Promise.resolve().then(() => detectSecurity(absoluteRoot)),
    Promise.resolve().then(() => scanDirectoryTopology(absoluteRoot)),
  ]);

  const entry_points = detectEntryPoints(absoluteRoot, frameworks);

  const fingerprint = {
    version: "1.0" as const,
    detected_at: new Date().toISOString(),
    project: {
      name: detectProjectName(absoluteRoot),
      root: absoluteRoot,
      type: detectProjectType(absoluteRoot),
      git_workflow: detectGitWorkflow(absoluteRoot),
    },
    languages,
    frameworks,
    entry_points,
    tooling,
    directory_topology,
    security_signals,
  };

  const result = FingerprintSchema.safeParse(fingerprint);
  if (!result.success) {
    throw new DetectorError(`Fingerprint validation failed: ${result.error.message}`, result.error);
  }

  return result.data;
}
