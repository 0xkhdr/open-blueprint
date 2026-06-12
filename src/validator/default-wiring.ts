/**
 * Default service wiring for the validation pipeline.
 *
 * This module is the validator's only sanctioned reference to higher layers
 * (translator adapters, plugin loader, registry install) and resolves them
 * with lazy `import()` so the static dependency graph stays downward.
 * Orchestrators that want different behavior inject their own services via
 * `ValidatorOptions.services`.
 */

import * as path from "node:path";
import { logger } from "../logger.js";
import type { BlueprintIR } from "../translator/ir.js";
import type { ValidationError } from "../types/validation.js";
import type {
  BlueprintSource,
  PluginEngine,
  ValidationContext,
  ValidatorServices,
} from "./contracts.js";

class DefaultBlueprintSource implements BlueprintSource {
  async parse(projectRoot: string, backend: string): Promise<BlueprintIR> {
    const { getRegisteredAdapter } = await import("../translator/adapters/registry.js");
    return getRegisteredAdapter(backend).parse(projectRoot);
  }
}

class DefaultPluginEngine implements PluginEngine {
  constructor(private readonly blueprintSource: BlueprintSource) {}

  async run(ctx: ValidationContext): Promise<ValidationError[]> {
    const { activePluginLevels, buildFileInventory } = await import("../plugins/context.js");
    const pluginLevels = activePluginLevels(ctx.options.level);
    if (pluginLevels.length === 0) return [];

    const { loadProjectConfigAsync } = await import("../config/project.js");
    const pluginConfig = await loadProjectConfigAsync(ctx.projectRoot);
    const { loadPlugins, pluginOutcomeErrors } = await import("../plugins/loader.js");

    // Stage 5: `artifact:<id>` plugin entries resolve through the lockfile to
    // the installed plugin bundle under .bp/plugins/.
    const errors: ValidationError[] = [];
    const specs: Parameters<typeof loadPlugins>[0] = [];
    for (const entry of pluginConfig?.plugins ?? []) {
      if (entry.path.startsWith("artifact:")) {
        const artifactId = entry.path.slice("artifact:".length);
        const { resolvePluginArtifactPath } = await import("../registry/install.js");
        const bundlePath = await resolvePluginArtifactPath(ctx.projectRoot, artifactId);
        if (!bundlePath) {
          errors.push({
            file: path.join(ctx.projectRoot, ".bp.json"),
            type: "PLUGIN_ARTIFACT_NOT_FOUND",
            severity: "error",
            message: `Plugin entry '${entry.path}' references an artifact that is not installed`,
            resolution: `Install it first: bp pack plugin:install <url-or-id> (artifact id '${artifactId}')`,
          });
          continue;
        }
        specs.push({ path: bundlePath, mode: entry.mode });
      } else {
        specs.push(entry);
      }
    }
    if (specs.length === 0) return errors;

    const { startSpan } = await import("../telemetry/tracer.js");
    const pluginErrors = await startSpan("bp.validate.plugins", async () => {
      let blueprint: BlueprintIR;
      try {
        blueprint = await this.blueprintSource.parse(ctx.projectRoot, ctx.manifest.backend);
      } catch (err) {
        logger.warn({ err }, "Plugin context unavailable: blueprint parse failed");
        return [
          {
            file: ctx.projectRoot,
            type: "PLUGIN_CONTEXT_UNAVAILABLE",
            severity: "warning" as const,
            message: `Plugins skipped: blueprint parse failed: ${err instanceof Error ? err.message : String(err)}`,
            resolution: "Fix blueprint parse errors, then re-run bp verify",
          },
        ];
      }

      const inventory = await buildFileInventory(ctx.projectRoot, ctx.manifest, ctx.files);
      const payload = {
        blueprint,
        ...(ctx.fingerprint ? { fingerprint: ctx.fingerprint } : {}),
        files: inventory,
        levels: pluginLevels,
      };
      const outcomes = await loadPlugins(specs, payload, ctx.projectRoot);
      return outcomes.flatMap((outcome) => pluginOutcomeErrors(outcome, ctx.projectRoot));
    });
    errors.push(...pluginErrors);
    return errors;
  }
}

export function resolveServices(overrides?: Partial<ValidatorServices>): ValidatorServices {
  const blueprintSource = overrides?.blueprintSource ?? new DefaultBlueprintSource();
  return {
    blueprintSource,
    pluginEngine: overrides?.pluginEngine ?? new DefaultPluginEngine(blueprintSource),
  };
}
