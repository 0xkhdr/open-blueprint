import * as fs from "node:fs";
import * as path from "node:path";
import { PermissionError } from "../errors.js";

export function resolveAndValidatePath(input: string, allowedBase?: string): string {
  const base = allowedBase ?? process.cwd();
  const resolved = path.resolve(base, input);

  // Normalize both paths to catch platform-specific separators
  const normalizedResolved = path.normalize(resolved);
  const normalizedBase = path.normalize(base);

  // Ensure resolved path is within the allowed base
  if (
    !normalizedResolved.startsWith(normalizedBase + path.sep) &&
    normalizedResolved !== normalizedBase
  ) {
    throw new PermissionError(
      `Path traversal blocked: '${input}' resolves outside allowed base '${base}'. Fix: Use a path within the project directory.`
    );
  }

  // Detect symlinks that escape the allowed base
  try {
    const real = fs.realpathSync(normalizedResolved);
    const realBase = fs.realpathSync(normalizedBase);
    if (!real.startsWith(realBase + path.sep) && real !== realBase) {
      throw new PermissionError(
        `Symlink escape blocked: '${input}' resolves to '${real}' outside allowed base. Fix: Use a path within the project directory.`
      );
    }
  } catch (err) {
    if (err instanceof PermissionError) throw err;
    // File doesn't exist yet — that's OK for output paths; skip realpath check
  }

  return normalizedResolved;
}
