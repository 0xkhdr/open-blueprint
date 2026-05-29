import * as path from "node:path";

export function safeOutputPath(requestedPath: string, projectRoot: string): string {
  const resolved = path.resolve(projectRoot, requestedPath);
  const rootResolved = path.resolve(projectRoot);

  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error(
      `Path traversal detected: ${requestedPath} resolves to ${resolved} which is outside ${rootResolved}`
    );
  }

  return resolved;
}
