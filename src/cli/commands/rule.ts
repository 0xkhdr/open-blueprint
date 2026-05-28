import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import fg from "fast-glob";
import matter from "gray-matter";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { EXIT_CODES } from "../../validator/index.js";
import { validateSemantic } from "../../validator/semantic.js";
import type { ValidationError } from "../../validator/structural.js";
import { validateStructural } from "../../validator/structural.js";

interface RuleMeta {
  filename: string;
  scope: string;
  severity: string;
  action: string;
}

function formatRuleError(err: ValidationError): void {
  const loc = err.line ? `:${err.line}` : "";
  if (err.severity === "error") {
    console.error(chalk.red(`  ✗ [${err.type}] ${err.file}${loc}`));
    console.error(chalk.red(`    ${err.message}`));
    console.error(chalk.yellow(`    → ${err.resolution}`));
  } else if (err.severity === "warning") {
    console.warn(chalk.yellow(`  ⚠ [${err.type}] ${err.file}${loc}`));
    console.warn(chalk.yellow(`    ${err.message}`));
    console.warn(chalk.dim(`    → ${err.resolution}`));
  } else {
    console.log(chalk.blue(`  ℹ [${err.type}] ${err.file}${loc}: ${err.message}`));
  }
}

export function createRuleCommand(): Command {
  const cmd = new Command("rule").description("Rule management utilities");

  cmd
    .command("test <file>")
    .description("Dry-run rule against mock/real repository files")
    .action(async (file: string) => {
      const resolvedPath = path.resolve(file);
      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`Error: File does not exist: ${file}`));
        process.exit(1);
      }

      try {
        const content = fs.readFileSync(resolvedPath, "utf-8");
        const parsed = matter(content);
        const scope = typeof parsed.data.scope === "string" ? parsed.data.scope : null;
        const severity = typeof parsed.data.severity === "string" ? parsed.data.severity : "soft";
        const action = typeof parsed.data.action === "string" ? parsed.data.action : "None";

        if (!scope) {
          console.error(chalk.red(`Error: Rule is missing required "scope" field in frontmatter.`));
          process.exit(1);
        }

        console.log(
          chalk.bold.cyan(`\n🧪 blueprint rule test — Dry-Running Rule: ${path.basename(file)}\n`)
        );
        console.log(
          `${chalk.bold("Severity:")} ${severity === "hard" ? chalk.red("hard (Error)") : chalk.yellow(severity)}`
        );
        console.log(`${chalk.bold("Action  :")} "${action}"`);
        console.log(`${chalk.bold("Scope   :")} "${scope}"\n`);

        const cwd = process.cwd();
        const matches = await fg(scope, {
          cwd,
          onlyFiles: true,
          dot: true,
          ignore: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.git/**",
            "**/coverage/**",
          ],
        });

        if (matches.length === 0) {
          console.log(chalk.yellow(`⚠ Scope pattern matched 0 files in this repository.`));
          console.log(chalk.dim("  Ensure the scope glob matches the intended files."));
        } else {
          console.log(
            chalk.green(
              `✔ Success: Scope pattern matched ${matches.length} file(s) in the repository:`
            )
          );
          const maxDisplay = 10;
          const displayFiles = matches.slice(0, maxDisplay);
          for (const match of displayFiles) {
            console.log(chalk.green(`    - ${match}`));
          }
          if (matches.length > maxDisplay) {
            console.log(chalk.dim(`    ... and ${matches.length - maxDisplay} more files.`));
          }
        }
        console.log();
        process.exit(0);
      } catch (e) {
        console.error(chalk.red(`Rule test failed: ${e instanceof Error ? e.message : String(e)}`));
        process.exit(1);
      }
    });

  cmd
    .command("lint <file>")
    .description("Check rule syntax and scope pattern")
    .action(async (file: string) => {
      const resolvedPath = path.resolve(file);
      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`Error: File does not exist: ${file}`));
        process.exit(1);
      }

      const cwd = process.cwd();
      const projectConfig = loadProjectConfig(cwd);
      const userConfig = loadUserConfig();
      const backend = projectConfig?.backend ?? userConfig.default_backend;

      try {
        const fingerprint = await detect(cwd);
        const pack = resolveTemplatePack(fingerprint, backend);
        const manifest = pack.manifest;

        const structuralErrors = validateStructural(resolvedPath, manifest);
        const semanticErrors = await validateSemantic([resolvedPath], {
          projectRoot: cwd,
          manifest,
        });

        const allErrors = [...structuralErrors, ...semanticErrors];

        if (allErrors.length === 0) {
          console.log(
            chalk.green(`✔ [ PASS ] Rule "${file}" is fully valid and conforms to backend spec.`)
          );
          process.exit(0);
        }

        console.log(chalk.bold.red(`\nRule "${file}" has validation issues:\n`));
        for (const err of allErrors) {
          formatRuleError(err);
        }

        const hasErrors = allErrors.some((e) => e.severity === "error");
        process.exit(hasErrors ? EXIT_CODES.STRUCTURAL_FAILURE : EXIT_CODES.SUCCESS);
      } catch (e) {
        console.error(chalk.red(`Lint error: ${e instanceof Error ? e.message : String(e)}`));
        process.exit(1);
      }
    });

  cmd
    .command("graph")
    .description("Visualize rule scope coverage as ASCII map")
    .action(async () => {
      const cwd = process.cwd();
      console.log(chalk.bold.cyan("\n📊 blueprint rule graph — Rule Scope Coverage Map\n"));

      // 1. Detect backend
      let backend = "claude";
      if (fs.existsSync(path.join(cwd, ".cursor"))) backend = "cursor";
      else if (fs.existsSync(path.join(cwd, "BLUEPRINT.md"))) backend = "generic";

      // 2. Load rules
      const rulesDir = path.join(
        cwd,
        backend === "claude" ? ".claude/rules" : backend === "cursor" ? ".cursor/rules" : "rules"
      );
      const rules: RuleMeta[] = [];

      if (fs.existsSync(rulesDir)) {
        const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
        for (const f of ruleFiles) {
          try {
            const content = fs.readFileSync(path.join(rulesDir, f), "utf-8");
            const parsed = matter(content);
            rules.push({
              filename: f,
              scope: typeof parsed.data.scope === "string" ? parsed.data.scope : "**/*",
              severity: typeof parsed.data.severity === "string" ? parsed.data.severity : "soft",
              action: typeof parsed.data.action === "string" ? parsed.data.action : "",
            });
          } catch {
            // Ignore
          }
        }
      }

      // 3. Gather major directories to display (depth <= 3)
      const allDirs = await fg("**/*", {
        cwd,
        onlyDirectories: true,
        ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/coverage/**"],
        deep: 3,
      });

      // Include root directory "."
      const dirList = [".", ...allDirs.map((d) => `./${d}`)].sort();

      // For each directory, identify matching rules
      const dirRulesMap = new Map<string, RuleMeta[]>();

      for (const dir of dirList) {
        const matched: RuleMeta[] = [];

        // Scan files in this directory to see if rules match
        const sampleFiles = await fg("**/*", {
          cwd: path.resolve(cwd, dir),
          onlyFiles: true,
          deep: 2,
          ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"],
        });

        const relFiles = sampleFiles.map((sf) =>
          path.join(dir === "." ? "" : dir.replace(/^\.\//, ""), sf)
        );

        for (const r of rules) {
          // Check if any file in the directory matches the rule's scope
          const minimatch = await import("picomatch");
          const isMatch = minimatch.default(r.scope);

          if (dir === "." && rules.length > 0) {
            matched.push(r);
            continue;
          }

          const matchesAny = relFiles.some((rf) => isMatch(rf));
          if (matchesAny) {
            matched.push(r);
          }
        }

        dirRulesMap.set(dir, matched);
      }

      // 4. Print ASCII tree
      const printTree = (dir: string, prefix = "") => {
        const rulesList = dirRulesMap.get(dir) || [];
        const isRoot = dir === ".";
        const displayName = isRoot ? "[Root]" : path.basename(dir);

        let statusText = "";
        if (rulesList.length === 0) {
          statusText = chalk.bold.yellow(" [UNCOVERED]");
        } else {
          // Check for conflicts
          const hardRules = rulesList.filter((r) => r.severity === "hard");
          if (hardRules.length > 1) {
            statusText = chalk.bold.red(
              ` [CONFLICT: ${hardRules.map((h) => h.filename).join(" vs ")}]`
            );
          } else {
            statusText = chalk.green(
              ` [Rules: ${rulesList.map((r) => r.filename.replace(".md", "")).join(", ")}]`
            );
          }
        }

        console.log(`${prefix}├── ${chalk.blue(displayName)}${statusText}`);

        // Find direct subdirectories
        const subDirs = dirList.filter((d) => {
          if (isRoot) {
            return d.startsWith("./") && !d.replace(/^\.\//, "").includes("/");
          } else {
            const rel = path.relative(dir, d);
            return rel && !rel.startsWith("..") && !rel.includes("/");
          }
        });

        for (let i = 0; i < subDirs.length; i++) {
          const sub = subDirs[i];
          if (sub) {
            printTree(sub, `${prefix}│   `);
          }
        }
      };

      printTree(".");

      // 5. Check for orphaned skills
      const skillsDir = path.join(
        cwd,
        backend === "claude" ? ".claude/skills" : backend === "cursor" ? ".cursor/skills" : "skills"
      );
      if (fs.existsSync(skillsDir) && rules.length > 0) {
        const skillFiles = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
        const orphaned: string[] = [];

        for (const sf of skillFiles) {
          try {
            const skillName = sf.replace(".md", "");
            const content = fs.readFileSync(path.join(skillsDir, sf), "utf-8");
            const parsed = matter(content);

            // Check if skill has when_to_use
            if (parsed.data.when_to_use) continue;

            // Check if referenced by any rule
            let referenced = false;
            for (const r of rules) {
              const ruleContent = fs.readFileSync(path.join(rulesDir, r.filename), "utf-8");
              if (ruleContent.includes(skillName)) {
                referenced = true;
                break;
              }
            }

            if (!referenced) {
              orphaned.push(sf);
            }
          } catch {
            // Ignore
          }
        }

        if (orphaned.length > 0) {
          console.log(chalk.bold.yellow("\n⚠️  Orphaned Skills Detected:"));
          for (const o of orphaned) {
            console.log(
              chalk.yellow(`  - ${o} (never referenced by rules, no when_to_use trigger)`)
            );
          }
        }
      }

      console.log();
      process.exit(EXIT_CODES.SUCCESS);
    });

  return cmd;
}
