import * as fs from "node:fs";
import * as path from "node:path";

export function safeOutputPath(requestedPath: string, projectRoot: string): string {
  const resolved = path.resolve(projectRoot, requestedPath);
  const rootResolved = path.resolve(projectRoot);

  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error(
      `Path traversal detected: ${requestedPath} resolves to ${resolved} which is outside ${rootResolved}`
    );
  }

  // Symlink-aware second pass (mirrors utils/paths.ts resolveAndValidatePath):
  // the prefix check alone misses links inside the root pointing outside it.
  try {
    const real = fs.realpathSync(resolved);
    const realRoot = fs.realpathSync(rootResolved);
    if (!real.startsWith(realRoot + path.sep) && real !== realRoot) {
      throw new Error(
        `Path traversal detected: ${requestedPath} is a symlink escaping ${rootResolved} (resolves to ${real})`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Path traversal detected")) throw err;
    // Path doesn't exist yet — fine for output paths; the prefix check above stands.
  }

  return resolved;
}
