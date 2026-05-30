import * as fsPromises from "node:fs/promises";
import * as vm from "node:vm";
import { PluginLoadError, PluginTimeoutError } from "../errors.js";
import { VALIDATION_TIMEOUT_MS } from "../validator/index.js";
import type { ValidationError } from "../validator/structural.js";
import { type PluginAPI, createPluginContext } from "./sandbox.js";

export interface PluginResult {
  pluginPath: string;
  errors: ValidationError[];
  warnings: string[];
}

export async function loadPlugin(pluginPath: string): Promise<PluginResult> {
  let code: string;
  try {
    code = await fsPromises.readFile(pluginPath, "utf-8");
  } catch (err) {
    throw new PluginLoadError(
      `Cannot read plugin file "${pluginPath}": ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let script: vm.Script;
  try {
    script = new vm.Script(code, { filename: pluginPath });
  } catch (err) {
    throw new PluginLoadError(
      `Plugin syntax error in "${pluginPath}": ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const collectedErrors: ValidationError[] = [];
  const warnings: string[] = [];

  const api: PluginAPI = {
    validate(result: ValidationError) {
      collectedErrors.push(result);
    },
    log(msg: string) {
      warnings.push(msg);
    },
    error(msg: string) {
      collectedErrors.push({
        file: pluginPath,
        type: "PLUGIN_ERROR",
        severity: "error",
        message: msg,
        resolution: `Fix the plugin at ${pluginPath}`,
      });
    },
  };

  const context = createPluginContext(api);

  const runPlugin = new Promise<void>((resolve, reject) => {
    try {
      script.runInContext(context);
      resolve();
    } catch (err) {
      reject(
        new PluginLoadError(
          `Plugin runtime error in "${pluginPath}": ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new PluginTimeoutError(`Plugin "${pluginPath}" timed out after ${VALIDATION_TIMEOUT_MS}ms`)),
      VALIDATION_TIMEOUT_MS
    )
  );

  await Promise.race([runPlugin, timeout]);

  return { pluginPath, errors: collectedErrors, warnings };
}

export async function loadPlugins(pluginPaths: string[]): Promise<PluginResult[]> {
  return Promise.all(pluginPaths.map((p) => loadPlugin(p)));
}
