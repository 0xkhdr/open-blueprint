import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getBackend, listBackendIds } from "../backends/registry.js";
import type { ProjectConfig } from "../config/project.js";

export type BackendDriftStatus = "in sync" | "drifted" | "missing" | "orphaned";

export interface BackendDriftResult {
  backend: string;
  status: BackendDriftStatus;
  message: string;
  filesChanged?: string[];
}

function resolveCommandsDir(backendId: string, projectRoot: string): string | null {
  const config = getBackend(backendId);
  if (!config.supportsCommands || !config.commandsPath) return null;
  if (config.globalHomeEnv) {
    const envVal = process.env[config.globalHomeEnv];
    const base = envVal ?? (config.fallbackGlobalPath ?? `~/.${backendId}/prompts`).replace(/^~/, os.homedir());
    return base;
  }
  return path.join(projectRoot, config.commandsPath);
}

function getBackendMtime(backendId: string, projectRoot: string): number {
  const config = getBackend(backendId);
  const dirs = [path.join(projectRoot, config.skillsPath)];
  const cmdDir = resolveCommandsDir(backendId, projectRoot);
  if (cmdDir) dirs.push(cmdDir);

  let maxMtime = 0;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir, { recursive: true }) as string[];
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile() && stat.mtimeMs > maxMtime) {
            maxMtime = stat.mtimeMs;
          }
        } catch {
          // Skip
        }
      }
    } catch {
      // Skip
    }
  }
  return maxMtime;
}

const DRIFT_BASELINE_FILE = ".bp-backend-drift-baseline.json";

function loadDriftBaseline(projectRoot: string): Record<string, number> {
  const baselinePath = path.join(projectRoot, DRIFT_BASELINE_FILE);
  if (!fs.existsSync(baselinePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as Record<string, number>;
  } catch {
    return {};
  }
}

export function saveDriftBaseline(projectRoot: string, backends: string[]): void {
  const baseline: Record<string, number> = {};
  for (const id of backends) {
    try {
      baseline[id] = getBackendMtime(id, projectRoot);
    } catch {
      baseline[id] = 0;
    }
  }
  fs.writeFileSync(
    path.join(projectRoot, DRIFT_BASELINE_FILE),
    JSON.stringify(baseline, null, 2),
    "utf-8"
  );
}

export function detectMultiBackendDrift(
  projectRoot: string,
  projectConfig: ProjectConfig
): BackendDriftResult[] {
  const results: BackendDriftResult[] = [];
  const configuredBackends = projectConfig.backends ?? (projectConfig.backend ? [projectConfig.backend] : []);
  const baseline = loadDriftBaseline(projectRoot);
  const allKnownIds = new Set(listBackendIds());

  // Check each configured backend
  for (const id of configuredBackends) {
    let config;
    try { config = getBackend(id); } catch {
      results.push({ backend: id, status: "missing", message: `Unknown backend "${id}" configured in .bp.json` });
      continue;
    }

    const skillsDir = path.join(projectRoot, config.skillsPath);
    if (!fs.existsSync(skillsDir)) {
      results.push({
        backend: id,
        status: "missing",
        message: `Backend "${id}" configured but not scaffolded — run bp init --tools ${id}`,
      });
      continue;
    }

    const currentMtime = getBackendMtime(id, projectRoot);
    const baselineMtime = baseline[id];

    if (baselineMtime === undefined) {
      results.push({ backend: id, status: "in sync", message: `Backend "${id}" is present (no baseline to compare)` });
    } else if (currentMtime > baselineMtime) {
      results.push({
        backend: id,
        status: "drifted",
        message: `Backend "${id}" files have changed since last baseline`,
        filesChanged: [],
      });
    } else {
      results.push({ backend: id, status: "in sync", message: `Backend "${id}" is in sync` });
    }
  }

  // Check for orphaned backend directories
  const configuredSet = new Set(configuredBackends);
  for (const id of allKnownIds) {
    if (configuredSet.has(id)) continue;
    let config;
    try { config = getBackend(id); } catch { continue; }
    const skillsDir = path.join(projectRoot, config.skillsPath);
    if (fs.existsSync(skillsDir)) {
      results.push({
        backend: id,
        status: "orphaned",
        message: `Backend "${id}" files found but not configured — run bp clean --tool ${id} or add to backends`,
      });
    }
  }

  return results;
}
