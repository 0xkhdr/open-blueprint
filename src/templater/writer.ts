import * as fs from "node:fs";
import * as path from "node:path";
import { hasMarkers, mergeContent, parseExistingFile } from "./merger.js";

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

function ensureDir(dirPath: string, dryRun: boolean): void {
  if (!dryRun) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readBlueprintIgnore(projectRoot: string): string[] {
  const ignorePath = path.join(projectRoot, ".blueprintignore");
  if (!fs.existsSync(ignorePath)) return [];
  return fs
    .readFileSync(ignorePath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
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
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const header = `--- ${filePath}\n+++ ${filePath} (new)\n`;

  const hunks: string[] = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    const oldLine = oldLines[i];
    const newLine = newLines[j];

    if (oldLine === newLine) {
      i++;
      j++;
    } else if (oldLine !== undefined && (newLine === undefined || oldLine !== newLine)) {
      hunks.push(`-${oldLine}`);
      i++;
    } else if (newLine !== undefined) {
      hunks.push(`+${newLine}`);
      j++;
    }
  }

  if (hunks.length === 0) return "";
  return header + hunks.join("\n");
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

  const ignorePatterns = readBlueprintIgnore(projectRoot);

  if (isIgnored(outputPath, ignorePatterns, projectRoot)) {
    return { path: outputPath, action: "skipped" };
  }

  const dirPath = path.dirname(outputPath);
  ensureDir(dirPath, dryRun);

  const exists = fs.existsSync(outputPath);

  if (!exists) {
    if (!dryRun) {
      fs.writeFileSync(outputPath, content, "utf-8");
    }
    return {
      path: outputPath,
      action: dryRun ? "dry-run" : "created",
      diff: dryRun ? generateUnifiedDiff(outputPath, "", content) : undefined,
    };
  }

  const existingContent = fs.readFileSync(outputPath, "utf-8");

  if (existingContent === content) {
    return { path: outputPath, action: "skipped" };
  }

  const existingHasMarkers = hasMarkers(existingContent);

  if (existingHasMarkers) {
    // Auto-merge: replace generated blocks, keep preserve blocks
    const merged = mergeContent(existingContent, content);
    const diff = generateUnifiedDiff(outputPath, existingContent, merged);
    if (!dryRun) {
      fs.writeFileSync(outputPath, merged, "utf-8");
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
      fs.writeFileSync(outputPath, content, "utf-8");
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
