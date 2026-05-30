import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { logger } from "../logger.js";

const VERSION_FILE_CANDIDATES: Record<string, string[]> = {
  claude: [".claude/settings.json", ".claude/version"],
  cursor: [".cursor/settings.json", ".cursor/version"],
  codex: [".codex/version", ".codex/settings.json"],
  "github-copilot": [".github/copilot/version"],
};

async function readVersionFromJson(filePath: string, key = "version"): Promise<string | null> {
  try {
    const raw = await fsPromises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const v = parsed[key];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

export async function detectBackendVersion(backendId: string): Promise<string | null> {
  const candidates = VERSION_FILE_CANDIDATES[backendId];
  if (!candidates) return null;

  for (const candidate of candidates) {
    try {
      await fsPromises.access(candidate);
      const version = await readVersionFromJson(candidate);
      if (version) return version;
      const raw = await fsPromises.readFile(candidate, "utf-8");
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    } catch {
      continue;
    }
  }
  return null;
}

function semverGte(detected: string, min: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const d = parse(detected);
  const m = parse(min);
  for (let i = 0; i < Math.max(d.length, m.length); i++) {
    const dv = d[i] ?? 0;
    const mv = m[i] ?? 0;
    if (dv > mv) return true;
    if (dv < mv) return false;
  }
  return true;
}

export async function checkBackendVersion(
  backendId: string,
  projectRoot: string,
  minVersion?: string,
  testedVersions?: string[]
): Promise<void> {
  const detected = await detectBackendVersion(path.join(projectRoot, backendId));
  if (!detected) return; // version detection failure is silent per spec 9.5

  if (minVersion && !semverGte(detected, minVersion)) {
    logger.warn(
      { backendId, detected, minVersion },
      `Backend "${backendId}" version ${detected} is below minimum ${minVersion}`
    );
  }

  if (testedVersions && testedVersions.length > 0 && !testedVersions.includes(detected)) {
    logger.warn(
      { backendId, detected, testedVersions },
      `Backend "${backendId}" version ${detected} is not in tested versions [${testedVersions.join(", ")}]`
    );
  }
}
