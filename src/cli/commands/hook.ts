import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import chalk from "chalk";
import { Command } from "commander";
import { detectHookCycles, validateHookSafety } from "../../validator/hook.js";
import { normalizeError } from "../../utils/errors.js";
import { BpError } from "../../errors.js";

function findHookDirs(cwd: string): string[] {
  const candidates = [
    path.join(cwd, ".claude", "hooks"),
    path.join(cwd, ".claude"),
    path.join(cwd, "hooks"),
  ];
  return candidates.filter((d) => fs.existsSync(d));
}

interface HookInfo {
  name: string;
  filePath: string;
  trigger: string;
  enabled: boolean;
  command: string;
}

function listHookFiles(cwd: string): HookInfo[] {
  const dirs = findHookDirs(cwd);
  const results: HookInfo[] = [];

  for (const dir of dirs) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (!/\.(js|ts|sh)$/.test(name)) continue;

      const filePath = path.join(dir, name);
      const trigger = name.startsWith("pre_tool_use")
        ? "pre_tool_use"
        : name.startsWith("post_tool_use")
          ? "post_tool_use"
          : "unknown";

      let command = "";
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const match = content.match(
          /(?:async\s+)?function\s+(\w+)\s*\(|export\s+default\s+(?:async\s+)?function\s+(\w+)/
        );
        command = match?.[1] ?? match?.[2] ?? "hook";
      } catch {
        command = "unknown";
      }

      results.push({
        name,
        filePath,
        trigger,
        enabled: true,
        command,
      });
    }
  }
  return results;
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

export function createHookCommand(): Command {
  const cmd = new Command("hook").description("Hook management");

  cmd
    .command("generate")
    .description("Generate hook stubs for current backend")
    .action(() => {
      const cwd = process.cwd();
      const hooksDir = path.join(cwd, ".claude", "hooks");

      try {
        if (!fs.existsSync(hooksDir)) {
          fs.mkdirSync(hooksDir, { recursive: true });
        }

        const preHookPath = path.join(hooksDir, "pre_tool_use.js");
        const postHookPath = path.join(hooksDir, "post_tool_use.js");

        const stubContent = `// bp-generated stub hook. Keep logic minimal.
export default async function hook(context) {
  // Hook logic goes here. Run validation checks before executing tool.
  return true;
}
`;

        fs.writeFileSync(preHookPath, stubContent, "utf-8");
        fs.writeFileSync(postHookPath, stubContent, "utf-8");

        console.log(chalk.green("  ✔ Generated stubs inside .claude/hooks/"));
      } catch (e) {
        console.error(
          chalk.red(`Failed to generate hooks: ${normalizeError(e).message}`)
        );
      }
    });

  cmd
    .command("list")
    .description("List hook files with trigger, command, and enabled status")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const cwd = process.cwd();
      const hooks = listHookFiles(cwd);

      if (opts.json) {
        console.log(JSON.stringify(hooks, null, 2));
        return;
      }

      if (hooks.length === 0) {
        console.log(chalk.dim("  No hook files found."));
        return;
      }

      console.log(chalk.bold("\n  Hooks:\n"));
      for (const h of hooks) {
        const status = h.enabled ? chalk.green("enabled") : chalk.dim("disabled");
        console.log(
          `  ${chalk.cyan(h.name)} [${chalk.yellow(h.trigger)}] fn:${h.command} — ${status}`
        );
        console.log(`    ${chalk.dim(h.filePath)}`);
      }
      console.log();
    });

  cmd
    .command("remove <name>")
    .description("Delete a hook file with confirmation")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (name: string, opts: { yes?: boolean }) => {
      const cwd = process.cwd();
      const hooks = listHookFiles(cwd);
      const target = hooks.find(
        (h) => h.name === name || h.name === `${name}.js` || h.name === `${name}.ts`
      );

      if (!target) {
        console.error(chalk.red(`  ✗ Hook not found: ${name}`));
        console.error(chalk.dim(`  Run 'bp hook list' to see available hooks.`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      const proceed =
        opts.yes || (await confirm(`Remove hook '${target.name}' at ${target.filePath}?`));
      if (!proceed) {
        console.log(chalk.dim("  Cancelled."));
        return;
      }

      try {
        fs.unlinkSync(target.filePath);
        console.log(chalk.green(`  ✔ Removed ${target.filePath}`));
      } catch (e) {
        console.error(
          chalk.red(`  ✗ Failed to remove: ${normalizeError(e).message}`)
        );
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }
    });

  cmd
    .command("validate [file]")
    .description("Validate hook safety or run dependency cycle detection")
    .option("--cycle-check", "Run hook dependency cycle detection instead of safety validation")
    .action((file: string | undefined, opts: { cycleCheck?: boolean }) => {
      const cwd = process.cwd();

      if (opts.cycleCheck || !file) {
        // Run cycle detection across all hooks
        const hooks = listHookFiles(cwd);
        const graph: Record<string, string[]> = {};

        for (const h of hooks) {
          try {
            const content = fs.readFileSync(h.filePath, "utf-8");
            // Extract dependencies from import/require statements
            const deps: string[] = [];
            const importMatches = content.matchAll(/(?:import|require)\s*\(?['"]([^'"]+)['"]/g);
            for (const m of importMatches) {
              const match0 = m[1];
              if (match0 === undefined) continue;
              const dep = path.basename(match0, path.extname(match0));
              // Only include local hook refs (relative paths)
              if (match0.startsWith(".")) {
                deps.push(dep);
              }
            }
            graph[path.basename(h.filePath, path.extname(h.filePath))] = deps;
          } catch {
            graph[h.name] = [];
          }
        }

        const result = detectHookCycles(graph);
        if (result.hasCycle) {
          console.error(chalk.red("  ✗ Cycle detected in hook dependencies!"));
          if (result.cyclePath) {
            console.error(chalk.yellow(`  Path: ${result.cyclePath.join(" → ")}`));
          }
          throw new BpError("Command failed", 1, "CMD_ERROR", "");
        } else {
          console.log(chalk.green(`  ✔ No cycles detected across ${hooks.length} hook(s).`));
        }
        return;
      }

      // File-level safety validation
      const resolved = path.resolve(file);
      const errors = validateHookSafety(resolved);

      if (errors.length === 0) {
        console.log(chalk.green(`  ✔ Hook safety check passed for ${file}`));
      } else {
        console.error(
          chalk.red(`  ✗ Safety check failed with ${errors.length} error(s) in ${file}:`)
        );
        for (const err of errors) {
          console.error(chalk.red(`    [${err.type}] ${err.message}`));
          console.error(chalk.yellow(`    → ${err.resolution}`));
        }
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }
    });

  return cmd;
}
