import * as path from "node:path";
import type { FileSystem } from "../utils/fs.js";
import { logger } from "../logger.js";

async function readJson(fs: FileSystem, filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readYaml(fs: FileSystem, filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

function parseYamlPackages(content: string): string[] {
  const packages: string[] = [];
  const lines = content.split("\n");
  let inPackages = false;
  for (const line of lines) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const match = line.match(/^\s+-\s+["']?([^"'\n]+)["']?/);
      if (match?.[1]) {
        packages.push(match[1].trim());
      } else if (line.match(/^\S/) && !line.match(/^\s+-/)) {
        inPackages = false;
      }
    }
  }
  return packages;
}

export async function parseWorkspacePackages(root: string, fs: FileSystem): Promise<string[]> {
  const results: string[] = [];

  // pnpm-workspace.yaml
  const pnpmWorkspace = await readYaml(fs, path.join(root, "pnpm-workspace.yaml"));
  if (pnpmWorkspace) {
    try {
      const pkgs = parseYamlPackages(pnpmWorkspace);
      results.push(...pkgs);
    } catch (err) {
      logger.warn({ err }, "Failed to parse pnpm-workspace.yaml packages");
    }
    if (results.length > 0) return [...new Set(results)];
  }

  // package.json#workspaces
  const pkgJson = await readJson(fs, path.join(root, "package.json"));
  if (pkgJson) {
    const workspaces = pkgJson.workspaces;
    if (Array.isArray(workspaces)) {
      results.push(...workspaces.filter((w): w is string => typeof w === "string"));
    } else if (workspaces && typeof workspaces === "object" && Array.isArray((workspaces as Record<string, unknown>).packages)) {
      results.push(
        ...((workspaces as Record<string, unknown>).packages as string[]).filter(
          (w): w is string => typeof w === "string"
        )
      );
    }
  }

  // nx.json#projects
  const nxJson = await readJson(fs, path.join(root, "nx.json"));
  if (nxJson) {
    const projects = nxJson.projects;
    if (projects && typeof projects === "object" && !Array.isArray(projects)) {
      results.push(...Object.keys(projects));
    } else if (Array.isArray(projects)) {
      results.push(...projects.filter((p): p is string => typeof p === "string"));
    }
  }

  // lerna.json#packages
  const lernaJson = await readJson(fs, path.join(root, "lerna.json"));
  if (lernaJson) {
    const packages = lernaJson.packages;
    if (Array.isArray(packages)) {
      results.push(...packages.filter((p): p is string => typeof p === "string"));
    }
  }

  if (results.length === 0) {
    logger.warn({ root }, "No workspace packages found in monorepo config");
  }

  return [...new Set(results)];
}
