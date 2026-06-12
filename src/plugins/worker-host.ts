/**
 * Worker host for isolated plugin execution (Stage 4).
 *
 * Spawns a worker thread per plugin with a hard wall-clock timeout enforced
 * by `worker.terminate()` and a heap cap via `resourceLimits`. Workers are
 * NOT a security sandbox — they limit runtime/memory and protect validator
 * state, nothing more (see docs/plugin-api.md).
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { PluginLoadError, PluginTimeoutError } from "../errors.js";
import type { PluginRunPayload } from "./context.js";
import type { PluginExecutionResult } from "./runner.js";
import type { WorkerOutput } from "./worker-entry.js";

export const DEFAULT_PLUGIN_TIMEOUT_MS = 10_000;
export const DEFAULT_PLUGIN_MEMORY_MB = 256;

export function pluginTimeoutMs(): number {
  const raw = Number(process.env.BP_PLUGIN_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PLUGIN_TIMEOUT_MS;
}

export interface WorkerRunOptions {
  timeoutMs?: number;
  maxOldGenerationSizeMb?: number;
}

function resolveWorkerEntry(): URL {
  const compiled = new URL("./worker-entry.js", import.meta.url);
  if (existsSync(fileURLToPath(compiled))) {
    return compiled;
  }
  // Dev/test path: TypeScript sources run directly (vitest/tsx). Worker threads
  // don't inherit the host's loader, so bootstrap one inside the worker: a
  // data: URL module registers tsx and then imports the .ts entry.
  const require = createRequire(import.meta.url);
  const tsxApi = pathToFileURL(require.resolve("tsx/esm/api")).href;
  const tsEntry = new URL("./worker-entry.ts", import.meta.url).href;
  const bootstrap =
    `import { register } from ${JSON.stringify(tsxApi)};\n` +
    `register();\n` +
    `await import(${JSON.stringify(tsEntry)});\n`;
  return new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`);
}

export async function runPluginInWorker(
  pluginPath: string,
  payload: PluginRunPayload,
  options: WorkerRunOptions = {}
): Promise<PluginExecutionResult> {
  const timeoutMs = options.timeoutMs ?? pluginTimeoutMs();
  const memoryMb = options.maxOldGenerationSizeMb ?? DEFAULT_PLUGIN_MEMORY_MB;
  const entry = resolveWorkerEntry();

  const worker = new Worker(entry, {
    workerData: { pluginPath, payload },
    resourceLimits: { maxOldGenerationSizeMb: memoryMb },
  });

  return await new Promise<PluginExecutionResult>((resolve, reject) => {
    let settled = false;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      settle();
    };

    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new PluginTimeoutError(
            `Plugin "${pluginPath}" timed out after ${timeoutMs}ms`,
            "Reduce plugin work or raise BP_PLUGIN_TIMEOUT_MS"
          )
        )
      );
    }, timeoutMs);

    worker.on("message", (msg: WorkerOutput) => {
      if (msg.ok) {
        finish(() => resolve(msg.result));
      } else {
        finish(() =>
          reject(new PluginLoadError(`Plugin "${pluginPath}" failed: ${msg.error.message}`))
        );
      }
    });

    worker.on("error", (err: Error) => {
      finish(() =>
        reject(new PluginLoadError(`Plugin worker for "${pluginPath}" crashed: ${err.message}`))
      );
    });

    worker.on("exit", (code) => {
      if (!settled && code !== 0) {
        finish(() =>
          reject(new PluginLoadError(`Plugin worker for "${pluginPath}" exited with code ${code}`))
        );
      }
    });
  });
}
