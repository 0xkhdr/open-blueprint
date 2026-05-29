import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import {
  cleanupExpiredMemory,
  enforceMemoryGovernance,
  type MemoryGovernanceConfig,
} from "../../multiagent/memory.js";
import { BlueprintIRSchema } from "../../translator/ir.js";

function loadIR(cwd: string) {
  const blueprintPath = path.join(cwd, ".claude", "blueprint.json");
  if (!fs.existsSync(blueprintPath)) return null;
  try {
    return BlueprintIRSchema.parse(JSON.parse(fs.readFileSync(blueprintPath, "utf-8")));
  } catch {
    return null;
  }
}

export function createMemoryCommand(): Command {
  const memory = new Command("memory").description("Audit and govern persistent memory directories");

  memory
    .command("audit")
    .description("Audit memory directory for size, retention, and encryption compliance")
    .option("--dir <path>", "Memory directory path (default: .claude/memory)")
    .option("--max-size <mb>", "Max size in MB", "100")
    .option("--retention <policy>", "Retention policy: session|day|week|persistent", "week")
    .option("--require-encryption", "Require encryption at rest")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Check without modifying")
    .action(
      (opts: {
        dir?: string;
        maxSize?: string;
        retention?: string;
        requireEncryption?: boolean;
        json?: boolean;
        dryRun?: boolean;
      }) => {
        const cwd = process.cwd();
        const ir = loadIR(cwd);

        const memDir = path.resolve(
          cwd,
          opts.dir ??
            ir?.orchestration?.persistent_memory?.directory ??
            ".claude/memory"
        );

        const retentionPolicy = (
          opts.retention ??
          ir?.orchestration?.persistent_memory?.retention_policy ??
          "week"
        ) as MemoryGovernanceConfig["retention_policy"];

        const config: MemoryGovernanceConfig = {
          retention_policy: retentionPolicy,
          max_size_mb: Number(opts.maxSize ?? 100),
          encryption_at_rest:
            opts.requireEncryption ??
            (ir?.orchestration?.persistent_memory?.encryption ?? false),
          access_control: [],
        };

        const result = enforceMemoryGovernance(memDir, config);

        if (opts.json) {
          console.log(JSON.stringify({ directory: memDir, config, ...result }, null, 2));
          return;
        }

        const sizeKB = (result.stats.size_bytes / 1024).toFixed(1);
        const sizeMB = (result.stats.size_bytes / 1024 / 1024).toFixed(2);
        console.log(chalk.bold("\n Memory Audit\n"));
        console.log(chalk.dim(`  directory: ${memDir}`));
        console.log(chalk.dim(`  size: ${sizeMB}MB (${sizeKB}KB)`));
        console.log(chalk.dim(`  files: ${result.stats.file_count}`));
        console.log(chalk.dim(`  retention: ${retentionPolicy}`));
        console.log();

        if (result.compliant) {
          console.log(chalk.green("✓ Memory directory compliant"));
        } else {
          console.error(chalk.red(`✗ ${result.violations.length} violation(s):`));
          for (const v of result.violations) {
            console.error(chalk.red(`  • ${v}`));
          }
          if (!opts.dryRun) process.exit(1);
        }
      }
    );

  memory
    .command("cleanup")
    .description("Remove files exceeding the retention policy")
    .option("--dir <path>", "Memory directory path (default: .claude/memory)")
    .option("--retention <policy>", "Retention policy: session|day|week|persistent", "week")
    .option("--json", "Output as JSON")
    .option("--dry-run", "List files to remove without deleting")
    .action(
      (opts: {
        dir?: string;
        retention?: string;
        json?: boolean;
        dryRun?: boolean;
      }) => {
        const cwd = process.cwd();
        const ir = loadIR(cwd);

        const memDir = path.resolve(
          cwd,
          opts.dir ??
            ir?.orchestration?.persistent_memory?.directory ??
            ".claude/memory"
        );

        const retentionPolicy = (
          opts.retention ?? "week"
        ) as MemoryGovernanceConfig["retention_policy"];

        if (!fs.existsSync(memDir)) {
          if (opts.json) {
            console.log(JSON.stringify({ removed: [], message: "Directory does not exist" }));
          } else {
            console.log(chalk.dim("Memory directory does not exist — nothing to clean."));
          }
          return;
        }

        if (opts.dryRun) {
          // Preview: list files that would be removed
          const now = Date.now();
          const maxAge = retentionToMs(retentionPolicy);
          const allFiles = listFilesRecursive(memDir);
          const toRemove = maxAge === Infinity
            ? []
            : allFiles.filter((f) => {
                const stat = fs.statSync(path.join(memDir, f));
                return now - stat.mtimeMs > maxAge;
              });

          if (opts.json) {
            console.log(JSON.stringify({ would_remove: toRemove }));
          } else {
            console.log(chalk.yellow(`Would remove ${toRemove.length} file(s):`));
            for (const f of toRemove) console.log(chalk.dim(`  - ${f}`));
          }
          return;
        }

        const removed = cleanupExpiredMemory(memDir, retentionPolicy);

        if (opts.json) {
          console.log(JSON.stringify({ removed }));
          return;
        }

        if (removed.length === 0) {
          console.log(chalk.green("✓ No expired files found"));
        } else {
          console.log(chalk.green(`✓ Removed ${removed.length} expired file(s):`));
          for (const f of removed) console.log(chalk.dim(`  - ${f}`));
        }
      }
    );

  return memory;
}

function retentionToMs(policy: string): number {
  switch (policy) {
    case "session":
      return 24 * 60 * 60 * 1000;
    case "day":
      return 7 * 24 * 60 * 60 * 1000;
    case "week":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return Infinity;
  }
}

function listFilesRecursive(dir: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = listFilesRecursive(path.join(dir, entry.name));
      result.push(...sub.map((f) => path.join(entry.name, f)));
    } else {
      result.push(entry.name);
    }
  }
  return result;
}
