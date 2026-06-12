/**
 * Plugin loader — routes configured plugins through the isolated worker host
 * or the in-process inline engine, with per-plugin failure containment
 * (Stage 4: replaces the former vm-based sandbox).
 */
import * as path from "node:path";
import { PluginLoadError, PluginTimeoutError } from "../errors.js";
import type { ValidationError } from "../types/validation.js";
import { diagnosticType, type PluginRunPayload } from "./context.js";
import { executePluginModule, type PluginExecutionResult } from "./runner.js";
import { runPluginInWorker, type WorkerRunOptions } from "./worker-host.js";

export type PluginMode = "isolated" | "inline";

export interface PluginSpec {
  path: string;
  mode: PluginMode;
}

export type PluginOutcome =
  | { kind: "ok"; spec: PluginSpec; result: PluginExecutionResult }
  | { kind: "path-escape"; spec: PluginSpec; message: string }
  | { kind: "timeout"; spec: PluginSpec; message: string }
  | { kind: "load-error"; spec: PluginSpec; message: string };

export type PluginPathResolution =
  | { ok: true; absolutePath: string }
  | { ok: false; reason: string };

/**
 * Containment guard: plugin paths must resolve inside the project root.
 * Rejects `..` escapes and absolute paths outside the root.
 */
export function resolvePluginPath(projectRoot: string, pluginPath: string): PluginPathResolution {
  const root = path.resolve(projectRoot);
  const absolute = path.resolve(root, pluginPath);
  const rel = path.relative(root, absolute);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    return {
      ok: false,
      reason: `Plugin path "${pluginPath}" resolves outside the project root "${root}"`,
    };
  }
  return { ok: true, absolutePath: absolute };
}

async function runPlugin(
  spec: PluginSpec,
  absolutePath: string,
  payload: PluginRunPayload,
  workerOptions: WorkerRunOptions
): Promise<PluginExecutionResult> {
  if (spec.mode === "inline") {
    // Clone so deep-freezing the context never touches host state.
    return executePluginModule(absolutePath, structuredClone(payload));
  }
  return runPluginInWorker(absolutePath, payload, workerOptions);
}

/**
 * Run all configured plugins. Never throws for a single bad plugin: every
 * failure is captured as an outcome so other plugins still report.
 */
export async function loadPlugins(
  specs: PluginSpec[],
  payload: PluginRunPayload,
  projectRoot: string,
  workerOptions: WorkerRunOptions = {}
): Promise<PluginOutcome[]> {
  const outcomes: PluginOutcome[] = [];
  for (const spec of specs) {
    const resolved = resolvePluginPath(projectRoot, spec.path);
    if (!resolved.ok) {
      outcomes.push({ kind: "path-escape", spec, message: resolved.reason });
      continue;
    }
    try {
      const result = await runPlugin(spec, resolved.absolutePath, payload, workerOptions);
      outcomes.push({ kind: "ok", spec, result });
    } catch (err) {
      if (err instanceof PluginTimeoutError) {
        outcomes.push({ kind: "timeout", spec, message: err.message });
      } else if (err instanceof PluginLoadError) {
        outcomes.push({ kind: "load-error", spec, message: err.message });
      } else {
        outcomes.push({
          kind: "load-error",
          spec,
          message: `Unexpected plugin failure: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }
  return outcomes;
}

/** Map a plugin outcome to validator-level diagnostics. */
export function pluginOutcomeErrors(
  outcome: PluginOutcome,
  projectRoot: string
): ValidationError[] {
  const specFile = path.resolve(projectRoot, outcome.spec.path);
  switch (outcome.kind) {
    case "path-escape":
      return [
        {
          file: specFile,
          type: "PLUGIN_PATH_ESCAPE",
          severity: "error",
          message: outcome.message,
          resolution:
            "Move the plugin inside the project root and reference it with a relative path in .bp.json",
        },
      ];
    case "timeout":
      return [
        {
          file: specFile,
          type: "PLUGIN_TIMEOUT",
          severity: "error",
          message: outcome.message,
          resolution: "Reduce plugin work or raise BP_PLUGIN_TIMEOUT_MS",
        },
      ];
    case "load-error":
      return [
        {
          file: specFile,
          type: "PLUGIN_LOAD_ERROR",
          severity: "error",
          message: outcome.message,
          resolution: `Fix or remove plugin '${outcome.spec.path}' from .bp.json`,
        },
      ];
    case "ok": {
      const { result } = outcome;
      const errors: ValidationError[] = result.diagnostics.map((d) => ({
        file: d.file,
        ...(d.line !== undefined ? { line: d.line } : {}),
        type: diagnosticType(result.pluginName, d.validatorId),
        severity: d.severity,
        message: d.message,
        resolution: d.resolution,
      }));
      if (result.crash) {
        errors.push({
          file: specFile,
          type: "PLUGIN_CRASHED",
          severity: "error",
          message: result.crash.message,
          resolution: `Fix or remove plugin '${result.pluginName}' from .bp.json`,
        });
      }
      return errors;
    }
  }
}
