import * as fs from "node:fs";
import * as path from "node:path";
import type { ValidationError } from "./structural.js";

export interface CacheEntry {
  mtime: number;
  errors: ValidationError[];
}

export interface ValidationCache {
  version: string;
  manifestVersion: string;
  files: Record<string, CacheEntry>;
}

const CACHE_DIR = ".bp";
const CACHE_FILE = "cache.json";

export function getCachePath(projectRoot: string): string {
  return path.join(projectRoot, CACHE_DIR, CACHE_FILE);
}

export function loadCache(projectRoot: string, manifestVersion: string): ValidationCache {
  const cachePath = getCachePath(projectRoot);
  const defaultCache: ValidationCache = {
    version: "1.0",
    manifestVersion,
    files: {},
  };

  if (!fs.existsSync(cachePath)) {
    return defaultCache;
  }

  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as ValidationCache;
    if (parsed.version === "1.0" && parsed.manifestVersion === manifestVersion) {
      return parsed;
    }
  } catch {
    // Ignore and return default
  }

  return defaultCache;
}

export function saveCache(projectRoot: string, cache: ValidationCache): void {
  const cachePath = getCachePath(projectRoot);
  try {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Ignore write failures
  }
}
