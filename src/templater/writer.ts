import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createPatch } from "diff";
import { logger } from "../logger.js";
import { hasMarkers, mergeContent, parseExistingFile } from "./merger.js";

function emitFileWriteAudit(filePath: string, operation: string): void {
  logger.info({
    event: "file.write",
    path: filePath,
    operation,
    user: os.userInfo().username,
  });
}

export interface WriteOptions {
  dryRun?: boolean;
  force?: boolean;
  projectRoot: string;
}

export interface WriteResult {
  path: string;
  action: "created" | "updated" | "skipped" | "dry-run";
  diff?: string | undefined;
}

export type ConflictResolution = "prompt" | "skip" | "overwrite";

async function ensureDir(dirPath: string, dryRun: boolean): Promise<void> {
  if (!dryRun) {
    await fsPromises.mkdir(dirPath, { recursive: true });
  }
}

async function readBlueprintIgnore(projectRoot: string): Promise<string[]> {
  const ignorePath = path.join(projectRoot, ".blueprintignore");
  try {
    const content = await fsPromises.readFile(ignorePath, "utf-8");
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}

function isIgnored(filePath: string, patterns: string[], projectRoot: string): boolean {
  const relative = path.relative(projectRoot, filePath);
  for (const pattern of patterns) {
    if (relative === pattern || relative.startsWith(`${pattern}/`)) return true;
    if (pattern.endsWith("*") && relative.startsWith(pattern.slice(0, -1))) return true;
  }
  return false;
}

function generateUnifiedDiff(filePath: string, oldContent: string, newContent: string): string {
  return createPatch(filePath, oldContent, newContent);
}

export async function writeFile(
  outputPath: string,
  content: string,
  options: WriteOptions,
  conflictResolution: ConflictResolution = "prompt"
): Promise<WriteResult> {
  const { dryRun = false, force = false, projectRoot } = options;

  // Path traversal prevention
  const absoluteRoot = path.resolve(projectRoot);
  const absoluteOut = path.resolve(outputPath);
  const relativePath = path.relative(absoluteRoot, absoluteOut);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `Path traversal detected: target path "${outputPath}" lies outside project root "${projectRoot}"`
    );
  }

  const ignorePatterns = await readBlueprintIgnore(projectRoot);

  if (isIgnored(outputPath, ignorePatterns, projectRoot)) {
    return { path: outputPath, action: "skipped" };
  }

  const dirPath = path.dirname(outputPath);
  await ensureDir(dirPath, dryRun);

  let existingContent: string | null = null;
  try {
    existingContent = await fsPromises.readFile(outputPath, "utf-8");
  } catch {
    // file does not exist
  }

  if (existingContent === null) {
    if (!dryRun) {
      await fsPromises.writeFile(outputPath, content, "utf-8");
      emitFileWriteAudit(outputPath, "init");
    }
    return {
      path: outputPath,
      action: dryRun ? "dry-run" : "created",
      diff: dryRun ? generateUnifiedDiff(outputPath, "", content) : undefined,
    };
  }

  if (existingContent === content) {
    return { path: outputPath, action: "skipped" };
  }

  const existingHasMarkers = hasMarkers(existingContent);

  if (existingHasMarkers) {
    // Auto-merge: replace generated blocks, keep preserve blocks
    const merged = mergeContent(existingContent, content);
    const diff = generateUnifiedDiff(outputPath, existingContent, merged);
    if (!dryRun) {
      await fsPromises.writeFile(outputPath, merged, "utf-8");
      emitFileWriteAudit(outputPath, "update");
    }
    return {
      path: outputPath,
      action: dryRun ? "dry-run" : "updated",
      diff,
    };
  }

  // No markers in existing file
  if (force || conflictResolution === "overwrite") {
    const diff = generateUnifiedDiff(outputPath, existingContent, content);
    if (!dryRun) {
      await fsPromises.writeFile(outputPath, content, "utf-8");
      emitFileWriteAudit(outputPath, "overwrite");
    }
    return {
      path: outputPath,
      action: dryRun ? "dry-run" : "updated",
      diff,
    };
  }

  if (conflictResolution === "skip") {
    return { path: outputPath, action: "skipped" };
  }

  // Default: skip without --force (will be prompted in interactive mode)
  return { path: outputPath, action: "skipped" };
}

// Re-export for use in index
export { parseExistingFile };
