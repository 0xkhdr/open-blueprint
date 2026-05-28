#!/usr/bin/env node
import { Command } from "commander";
import { createConfigCommand } from "./commands/config.js";
import { createConvertCommand } from "./commands/convert.js";
import { createDevCommand } from "./commands/dev.js";
import { createDiffCommand } from "./commands/diff.js";
import { createDocsCommand } from "./commands/docs.js";
import { createDoctorCommand } from "./commands/doctor.js";
import { createHookCommand } from "./commands/hook.js";
import { createInitCommand } from "./commands/init.js";
import { createMergeCommand } from "./commands/merge.js";
import { createMigrateCommand } from "./commands/migrate.js";
import { createRuleCommand } from "./commands/rule.js";
import { createSyncCommand } from "./commands/sync.js";
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

program.parseAsync(process.argv).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
