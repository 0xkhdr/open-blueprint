import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { logger } from "../logger.js";
import type { ValidationError } from "./structural.js";

export interface CacheEntry {
  mtime: number;
  contentHash: string;
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

export async function loadCacheAsync(
  projectRoot: string,
  manifestVersion: string
): Promise<ValidationCache> {
  const cachePath = getCachePath(projectRoot);
  const defaultCache: ValidationCache = { version: "1.0", manifestVersion, files: {} };

  try {
    const raw = await fsPromises.readFile(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as ValidationCache;
    if (parsed.version === "1.0" && parsed.manifestVersion === manifestVersion) {
      return parsed;
    }
  } catch (err) {
    logger.warn({ err }, "Async validation cache unreadable; starting fresh");
  }

  return defaultCache;
}

export async function saveCacheAsync(projectRoot: string, cache: ValidationCache): Promise<void> {
  const cachePath = getCachePath(projectRoot);
  try {
    const dir = path.dirname(cachePath);
    await fsPromises.mkdir(dir, { recursive: true });
    await fsPromises.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");
  } catch (err) {
    logger.warn({ err }, "Failed to write async validation cache");
  }
}
