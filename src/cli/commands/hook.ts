import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { validateHookSafety } from "../../validator/hook.js";

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
          chalk.red(`Failed to generate hooks: ${e instanceof Error ? e.message : String(e)}`)
        );
      }
    });
  cmd
    .command("validate <file>")
    .description("Validate hook safety")
    .action((file: string) => {
      const resolved = path.resolve(file);
      const errors = validateHookSafety(resolved);

      if (errors.length === 0) {
        console.log(chalk.green(`  ✔ Hook safety check passed for ${file}`));
        process.exit(0);
      } else {
        console.error(
          chalk.red(`  ✗ Safety check failed with ${errors.length} error(s) in ${file}:`)
        );
        for (const err of errors) {
          console.error(chalk.red(`    [${err.type}] ${err.message}`));
          console.error(chalk.yellow(`    → ${err.resolution}`));
        }
        process.exit(1);
      }
    });
  return cmd;
}
