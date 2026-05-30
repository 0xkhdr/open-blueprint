import * as path from "node:path";
import type { Logger } from "pino";
import { listBackendIds } from "../../backends/registry.js";
import { initProjectConfig, loadProjectConfig } from "../../config/project.js";
import { EXIT_CODES } from "../../constants.js";
import type { Fingerprint } from "../../detector/fingerprint.js";
import { detect } from "../../detector/index.js";
import { runTemplater } from "../../templater/index.js";
import { normalizeError } from "../../utils/errors.js";
import type { FileSystem } from "../../utils/fs.js";
import { RealFileSystem } from "../../utils/fs.js";

export interface InitOptions {
  backends: string[];
  template?: string | undefined;
  force: boolean;
  dryRun: boolean;
  json: boolean;
}

export interface InitContext {
  cwd: string;
  options: InitOptions;
  fs?: FileSystem;
  logger?: Logger;
}

export type MessageLevel = "info" | "success" | "warning" | "error";

export interface OrchestratorMessage {
  level: MessageLevel;
  text: string;
}

export interface OrchestratorResult {
  exitCode: number;
  messages: OrchestratorMessage[];
  filesWritten: string[];
  backends: Array<{ backend: string; filesWritten: string[]; templatePack?: string }>;
}

export class InitOrchestrator {
  private readonly ctx: Required<InitContext>;

  constructor(context: InitContext) {
    this.ctx = {
      cwd: context.cwd,
      options: context.options,
      fs: context.fs ?? new RealFileSystem(),
      logger: context.logger as Logger,
    };
  }

  async run(): Promise<OrchestratorResult> {
    const { cwd, options } = this.ctx;
    const messages: OrchestratorMessage[] = [];
    const allWritten: string[] = [];
    const backendResults: Array<{
      backend: string;
      filesWritten: string[];
      templatePack?: string;
    }> = [];

    const unknown = options.backends.filter((b) => !listBackendIds().includes(b));
    if (unknown.length > 0) {
      messages.push({
        level: "error",
        text: `Unknown backend ID(s): ${unknown.join(", ")}. Valid: ${listBackendIds().join(", ")}`,
      });
      return { exitCode: EXIT_CODES.UNSUPPORTED_BACKEND, messages, filesWritten: [], backends: [] };
    }

    let fingerprint: Fingerprint;
    try {
      fingerprint = await detect(cwd, this.ctx.fs);
      messages.push({
        level: "success",
        text: `Detected: ${fingerprint.project.name} [${fingerprint.languages
          .filter((l) => l.primary)
          .map((l) => l.name)
          .join(", ")}]`,
      });
    } catch (e) {
      messages.push({ level: "error", text: `Detection failed: ${normalizeError(e).message}` });
      return { exitCode: EXIT_CODES.GENERAL_ERROR, messages, filesWritten: [], backends: [] };
    }

    for (const backend of options.backends) {
      try {
        const result = await runTemplater(fingerprint, cwd, {
          backend,
          templateOverride: options.template,
          dryRun: options.dryRun,
          force: options.force,
        });

        messages.push({
          level: "success",
          text: `${backend}: Blueprint generated (${result.files.length} files)`,
        });

        for (const f of result.files) {
          if (f.action === "created")
            messages.push({ level: "info", text: `+ ${path.relative(cwd, f.path)}` });
          else if (f.action === "updated")
            messages.push({ level: "info", text: `~ ${path.relative(cwd, f.path)}` });
        }

        allWritten.push(...result.files.map((f) => f.path));
        backendResults.push({
          backend,
          filesWritten: result.files.map((f) => f.path),
          templatePack: result.templatePack,
        });
      } catch (e) {
        messages.push({
          level: "error",
          text: `${backend}: Generation failed: ${normalizeError(e).message}`,
        });
      }
    }

    if (!options.dryRun && !loadProjectConfig(cwd)) {
      initProjectConfig(cwd, options.backends);
      messages.push({ level: "info", text: "Created: .bp.json" });
    }

    if (options.dryRun) {
      messages.push({
        level: "warning",
        text: "[DRY RUN] No files written. Use without --dry-run to apply.",
      });
    }

    return {
      exitCode: EXIT_CODES.SUCCESS,
      messages,
      filesWritten: allWritten,
      backends: backendResults,
    };
  }
}
