#!/usr/bin/env node
import { Command } from "commander";
import { BpError } from "../errors.js";
import { initCorrelationId, logger, runWithCorrelationId } from "../logger.js";
import { createAgentCommand } from "./commands/agent.js";
import { createChainCommand } from "./commands/chain.js";
import { createConfigCommand } from "./commands/config.js";
import { createConvertCommand } from "./commands/convert.js";
import { createCostCommand } from "./commands/cost.js";
import { createDevCommand } from "./commands/dev.js";
import { createDiffCommand } from "./commands/diff.js";
import { createDocsCommand } from "./commands/docs.js";
import { createDoctorCommand } from "./commands/doctor.js";
import { createDriftCommand } from "./commands/drift.js";
import { createHealthCommand } from "./commands/health.js";
import { createHookCommand } from "./commands/hook.js";
import { createInitCommand } from "./commands/init.js";
import { createMarketplaceCommand } from "./commands/marketplace.js";
import { createMCPCommand } from "./commands/mcp.js";
import { createMemoryCommand } from "./commands/memory.js";
import { createMergeCommand } from "./commands/merge.js";
import { createMigrateCommand } from "./commands/migrate.js";
import { createRuleCommand } from "./commands/rule.js";
import { createSyncCommand } from "./commands/sync.js";
import { createTeamCommand } from "./commands/team.js";
import { createTelemetryCommand } from "./commands/telemetry.js";
import { createTemplateCommand } from "./commands/template.js";
import { createUpdateCommand } from "./commands/update.js";
import { createVerifyCommand } from "./commands/verify.js";

const pkg = {
  name: "@agentic/bp",
  version: "1.0.0",
  description: "Scaffold and verify governance structures for agentic AI tools",
};

const program = new Command();

program
  .name("bp")
  .description(pkg.description)
  .version(pkg.version, "-v, --version", "Output version number")
  .helpOption("-h, --help", "Show help");

program.addCommand(createInitCommand());
program.addCommand(createVerifyCommand());
program.addCommand(createSyncCommand());
program.addCommand(createConvertCommand());
program.addCommand(createDevCommand());
program.addCommand(createDocsCommand());
program.addCommand(createDiffCommand());
program.addCommand(createMergeCommand());
program.addCommand(createTemplateCommand());
program.addCommand(createDoctorCommand());
program.addCommand(createRuleCommand());
program.addCommand(createHookCommand());
program.addCommand(createConfigCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createMigrateCommand());
program.addCommand(createAgentCommand());
program.addCommand(createMCPCommand());
program.addCommand(createTeamCommand());
program.addCommand(createChainCommand());
program.addCommand(createMemoryCommand());
program.addCommand(createTelemetryCommand());
program.addCommand(createCostCommand());
program.addCommand(createDriftCommand());
program.addCommand(createMarketplaceCommand());
program.addCommand(createHealthCommand());

// Audit logging hook
program.hook("preAction", (_thisCommand, actionCommand) => {
  try {
    const { logAudit } = require("../security/audit.js");
    logAudit({
      command: actionCommand.name(),
      args: actionCommand.args,
      status: "success",
      log_level: "info",
    });
  } catch {
    // ESM dynamic import fallback
    import("../security/audit.js")
      .then(({ logAudit }) => {
        logAudit({
          command: actionCommand.name(),
          args: actionCommand.args,
          status: "success",
          log_level: "info",
        });
      })
      .catch(() => {});
  }
});

// Graceful shutdown handlers
process.on("SIGTERM", () => {
  logger.flush();
  process.exit(0);
});
process.on("SIGINT", () => {
  logger.flush();
  process.exit(0);
});

const correlationId = initCorrelationId();
const startMs = Date.now();

runWithCorrelationId(correlationId, () => {
  program
    .parseAsync(process.argv)
    .then(() => {
      const command = process.argv[2] ?? "unknown";
      logger.info({
        event: "command.complete",
        command,
        durationMs: Date.now() - startMs,
        exitCode: 0,
      });
    })
    .catch((e: unknown) => {
      const command = process.argv[2] ?? "unknown";
      const durationMs = Date.now() - startMs;
      if (e instanceof BpError) {
        logger.error(
          { event: "command.complete", command, durationMs, exitCode: e.exitCode, code: e.code },
          e.message
        );
        process.exit(e.exitCode);
      } else {
        logger.error(
          {
            event: "command.complete",
            command,
            durationMs,
            exitCode: 1,
            err: e instanceof Error ? e.stack : String(e),
          },
          "Unexpected error"
        );
        process.exit(1);
      }
    });
});
