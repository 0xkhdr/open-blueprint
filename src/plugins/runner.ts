/**
 * Plugin module executor — shared by the worker entry (isolated mode) and the
 * in-process inline mode. Imports the plugin module, re-validates its shape
 * via `definePlugin`, and runs the validators matching the requested levels.
 */
import { pathToFileURL } from "node:url";
import { PluginLoadError } from "../errors.js";
import { type BpPlugin, definePlugin } from "../plugin/index.js";
import {
  makeValidationContext,
  type PluginDiagnostic,
  type PluginRunPayload,
  prepareContextData,
} from "./context.js";

export interface PluginExecutionResult {
  pluginName: string;
  pluginVersion: string;
  diagnostics: PluginDiagnostic[];
  /** Set when a validator threw; diagnostics emitted before the crash are kept. */
  crash?: { message: string };
}

function errorSummary(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const stackHead = (err.stack ?? "").split("\n").slice(0, 4).join("\n");
  return stackHead || err.message;
}

export async function executePluginModule(
  pluginPath: string,
  payload: PluginRunPayload
): Promise<PluginExecutionResult> {
  let mod: Record<string, unknown>;
  try {
    mod = (await import(pathToFileURL(pluginPath).href)) as Record<string, unknown>;
  } catch (err) {
    throw new PluginLoadError(
      `Cannot load plugin module "${pluginPath}": ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const candidate = mod.default;
  if (!candidate || typeof candidate !== "object") {
    throw new PluginLoadError(
      `Plugin "${pluginPath}" must default-export definePlugin({ name, version, validators })`
    );
  }

  let plugin: BpPlugin;
  try {
    plugin = definePlugin(candidate as BpPlugin);
  } catch (err) {
    throw new PluginLoadError(
      `Plugin "${pluginPath}" is invalid: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const data = prepareContextData(payload);
  const diagnostics: PluginDiagnostic[] = [];
  const active = plugin.validators.filter((v) => payload.levels.includes(v.level));

  for (const validator of active) {
    const ctx = makeValidationContext(data, validator.id, diagnostics);
    try {
      await validator.check(ctx);
    } catch (err) {
      return {
        pluginName: plugin.name,
        pluginVersion: plugin.version,
        diagnostics,
        crash: { message: `Validator "${validator.id}" crashed: ${errorSummary(err)}` },
      };
    }
  }

  return { pluginName: plugin.name, pluginVersion: plugin.version, diagnostics };
}
