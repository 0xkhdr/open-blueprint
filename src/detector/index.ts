import * as path from "node:path";
import {
  KNOWN_CONFIG_DIRS,
  KNOWN_PACKAGE_DIRS,
  KNOWN_SERVER_FRAMEWORKS,
  KNOWN_SOURCE_DIRS,
  KNOWN_TEST_DIRS,
  KNOWN_UI_FRAMEWORKS,
} from "../constants.js";
import { type FileSystem, RealFileSystem } from "../utils/fs.js";
import { detectEnterpriseSignals, type EnterpriseSignals } from "./enterprise-signals.js";
import type { Fingerprint } from "./fingerprint.js";
import { FingerprintSchema } from "./fingerprint.js";
import { detectFrameworks } from "./frameworks.js";
import { detectLanguages } from "./languages.js";
import { detectSecurity } from "./security.js";
import { detectTooling } from "./tooling.js";

export type RiskTier = "low" | "medium" | "high" | "critical";
export type ApprovalMode = "auto" | "confirm" | "read-only";

export interface EnhancedFingerprint extends Fingerprint {
  risk_tier: RiskTier;
  suggested_approval_mode: ApprovalMode;
  estimated_monthly_tokens: number;
  enterprise_signals: EnterpriseSignals;
}

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

async function fileExists(filePath: string, fs: FileSystem): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectProjectName(root: string, fs: FileSystem): Promise<string> {
  const pkgPath = path.join(root, "package.json");
  if (await fileExists(pkgPath, fs)) {
    try {
      const raw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as { name?: string };
      if (pkg.name) return pkg.name.replace(/^@[^/]+\//, "");
    } catch {
      /* fall through */
    }
  }
  return path.basename(root);
}

async function detectProjectType(
  root: string,
  fs: FileSystem
): Promise<"monorepo" | "polyrepo" | "library" | "application" | "service"> {
  const [
    hasPnpmWorkspace,
    hasLerna,
    hasNx,
    hasTurbo,
    hasRush,
    hasPackages,
    hasDockerfile,
    hasDockerCompose,
  ] = await Promise.all([
    fileExists(path.join(root, "pnpm-workspace.yaml"), fs),
    fileExists(path.join(root, "lerna.json"), fs),
    fileExists(path.join(root, "nx.json"), fs),
    fileExists(path.join(root, "turbo.json"), fs),
    fileExists(path.join(root, "rush.json"), fs),
    fileExists(path.join(root, "packages"), fs),
    fileExists(path.join(root, "Dockerfile"), fs),
    fileExists(path.join(root, "docker-compose.yml"), fs),
  ]);

  if (hasPnpmWorkspace || hasLerna || hasNx || hasTurbo || hasRush || hasPackages)
    return "monorepo";

  const pkgPath = path.join(root, "package.json");
  if (await fileExists(pkgPath, fs)) {
    try {
      const raw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as {
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

  if (hasDockerfile || hasDockerCompose) return "service";

  return "application";
}

async function detectGitWorkflow(
  root: string,
  fs: FileSystem
): Promise<"github-flow" | "trunk-based" | "gitflow" | "unknown"> {
  const ghDir = path.join(root, ".github");
  const ghWorkflows = path.join(ghDir, "workflows");
  const gitHead = path.join(root, ".git", "HEAD");

  const [hasGhDir, hasGhWorkflows, hasGitHead] = await Promise.all([
    fileExists(ghDir, fs),
    fileExists(ghWorkflows, fs),
    fileExists(gitHead, fs),
  ]);

  if (hasGhDir && hasGhWorkflows) return "github-flow";

  if (hasGitHead) {
    try {
      const content = await fs.readFile(gitHead, "utf-8");
      if (content.includes("develop")) return "gitflow";
      if (content.includes("main") || content.includes("master")) return "trunk-based";
    } catch {
      /* skip */
    }
  }
  return "unknown";
}

async function scanDirectoryTopology(root: string, fs: FileSystem): Promise<DirectoryTopology> {
  const srcNames: string[] = [...KNOWN_SOURCE_DIRS];
  const testNames: string[] = [...KNOWN_TEST_DIRS];
  const configNames: string[] = [...KNOWN_CONFIG_DIRS];
  const packageNames: string[] = [...KNOWN_PACKAGE_DIRS];

  const src_dirs: string[] = [];
  const test_dirs: string[] = [];
  const config_dirs: string[] = [];
  const package_dirs: string[] = [];

  try {
    const entries = await fs.readdir(root);
    await Promise.all(
      entries.map(async (name) => {
        try {
          const stat = await fs.stat(path.join(root, name));
          if (!stat.isDirectory()) return;
          if (srcNames.includes(name)) src_dirs.push(name);
          if (testNames.includes(name)) test_dirs.push(name);
          if (configNames.includes(name)) config_dirs.push(name);
          if (packageNames.includes(name)) package_dirs.push(name);
        } catch {
          /* skip */
        }
      })
    );
  } catch {
    /* skip */
  }

  return { src_dirs, test_dirs, config_dirs, package_dirs };
}

async function detectEntryPoints(
  root: string,
  frameworks: Array<{ name: string }>,
  fs: FileSystem
): Promise<EntryPoint[]> {
  const entries: EntryPoint[] = [];

  const hasFramework = (name: string) => frameworks.some((f) => f.name === name);

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

  const serverFileChecks = await Promise.all(
    serverFiles.map((f) => fileExists(path.join(root, f), fs).then((exists) => ({ f, exists })))
  );

  const firstServer = serverFileChecks.find((c) => c.exists);
  if (firstServer) {
    const type: "server" | "ui" | "library" | "cli" = KNOWN_SERVER_FRAMEWORKS.some((n) =>
      hasFramework(n)
    )
      ? "server"
      : KNOWN_UI_FRAMEWORKS.some((n) => hasFramework(n))
        ? "ui"
        : "library";
    entries.push({ path: firstServer.f, type });
  }

  const pkgPath = path.join(root, "package.json");
  if (await fileExists(pkgPath, fs)) {
    try {
      const raw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as { bin?: Record<string, string> };
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

function detectRiskTier(fp: Fingerprint): RiskTier {
  const signals = fp.security_signals;
  let score = 0;

  if (signals.has_external_apis) score += 2;
  if (signals.has_secrets_manager) score += 2;
  if (signals.has_auth) score += 2;
  if (signals.has_docker) score += 1;

  if (signals.has_data_sensitive) score += 2;
  if (signals.has_financial_data) score += 2;
  if (signals.has_pii) score += 1;
  if (signals.has_encryption) score += 1;

  if (fp.project.type === "service") score += 1;
  if (fp.frameworks.some((f) => f.name.toLowerCase().includes("payment"))) score += 2;
  if (fp.frameworks.some((f) => f.name.toLowerCase().includes("auth"))) score += 1;

  return score >= 7 ? "critical" : score >= 5 ? "high" : score >= 3 ? "medium" : "low";
}

function detectApprovalMode(riskTier: RiskTier): ApprovalMode {
  return riskTier === "critical" ? "read-only" : riskTier === "high" ? "confirm" : "auto";
}

function estimateMonthlyTokens(fp: Fingerprint): number {
  const baseCost = 1000;
  const codefileMultiplier = Math.min(fp.directory_topology.src_dirs.length * 50, 5000);
  const frameworkMultiplier = fp.frameworks.length * 100;
  const complexityFactor = fp.project.type === "monorepo" ? 1.5 : 1;

  return Math.round((baseCost + codefileMultiplier + frameworkMultiplier) * complexityFactor);
}

export async function detect(
  projectRoot: string,
  fs: FileSystem = new RealFileSystem()
): Promise<Fingerprint> {
  const absoluteRoot = path.resolve(projectRoot);

  if (!(await fileExists(absoluteRoot, fs))) {
    throw new DetectorError(`Project root does not exist: ${absoluteRoot}`);
  }

  const [languages, frameworks, tooling, security_signals, directory_topology] = await Promise.all([
    Promise.resolve().then(() => detectLanguages(absoluteRoot)),
    Promise.resolve().then(() => detectFrameworks(absoluteRoot)),
    Promise.resolve().then(() => detectTooling(absoluteRoot)),
    Promise.resolve().then(() => detectSecurity(absoluteRoot)),
    scanDirectoryTopology(absoluteRoot, fs),
  ]);

  const [name, type, git_workflow, entry_points] = await Promise.all([
    detectProjectName(absoluteRoot, fs),
    detectProjectType(absoluteRoot, fs),
    detectGitWorkflow(absoluteRoot, fs),
    detectEntryPoints(absoluteRoot, frameworks, fs),
  ]);

  const fingerprint = {
    version: "1.0" as const,
    detected_at: new Date().toISOString(),
    project: {
      name,
      root: absoluteRoot,
      type,
      git_workflow,
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

export function enrichFingerprint(fp: Fingerprint): EnhancedFingerprint {
  const risk_tier = detectRiskTier(fp);
  const suggested_approval_mode = detectApprovalMode(risk_tier);
  const estimated_monthly_tokens = estimateMonthlyTokens(fp);
  const enterprise_signals = detectEnterpriseSignals(fp.project.root);

  return {
    ...fp,
    risk_tier,
    suggested_approval_mode,
    estimated_monthly_tokens,
    enterprise_signals,
  };
}
