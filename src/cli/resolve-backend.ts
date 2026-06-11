/**
 * Resolve the active backend's template pack manifest for CLI commands:
 * explicit flag → project config (`.bp.json`) → user config default.
 */

import { loadProjectConfig } from "../config/project.js";
import { loadUserConfig } from "../config/user.js";
import { detect } from "../detector/index.js";
import type { BackendManifest } from "../templater/selector.js";
import { resolveTemplatePack } from "../templater/selector.js";

export function resolveBackendName(cwd: string, override?: string): string {
  if (override) return override;
  const projectConfig = loadProjectConfig(cwd);
  const userConfig = loadUserConfig();
  return projectConfig?.backend ?? userConfig.default_backend;
}

export async function resolveBackendManifest(
  cwd: string,
  override?: string
): Promise<BackendManifest> {
  const backend = resolveBackendName(cwd, override);
  const fingerprint = await detect(cwd);
  return resolveTemplatePack(fingerprint, backend).manifest;
}
