/**
 * Worker-thread entry for isolated plugin execution. Receives the plugin path
 * and structured-clone payload via workerData, runs the plugin, and posts the
 * result (or a safely serialized error) back to the host.
 */
import { parentPort, workerData } from "node:worker_threads";
import type { PluginRunPayload } from "./context.js";
import { executePluginModule } from "./runner.js";

export interface WorkerInput {
  pluginPath: string;
  payload: PluginRunPayload;
}

export type WorkerOutput =
  | { ok: true; result: Awaited<ReturnType<typeof executePluginModule>> }
  | { ok: false; error: { message: string; stack?: string } };

async function main(): Promise<void> {
  if (!parentPort) return;
  const { pluginPath, payload } = workerData as WorkerInput;
  let output: WorkerOutput;
  try {
    output = { ok: true, result: await executePluginModule(pluginPath, payload) };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    const stack = (e.stack ?? "").split("\n").slice(0, 4).join("\n");
    output = { ok: false, error: { message: e.message, ...(stack ? { stack } : {}) } };
  }
  parentPort.postMessage(output);
}

void main();
