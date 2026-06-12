import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import fg from "fast-glob";
import matter from "gray-matter";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { BpError } from "../../errors.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { normalizeError } from "../../utils/errors.js";
import { defaultResourceBudget, evaluateCheck } from "../../validator/checks/evaluate.js";
import type { Check } from "../../validator/checks/schema.js";
import { CheckSchema } from "../../validator/checks/schema.js";
import { EXIT_CODES } from "../../validator/index.js";
import { validateSemantic } from "../../validator/semantic.js";
import type { ValidationError } from "../../validator/structural.js";
import { validateStructural } from "../../validator/structural.js";
import { installArtifactRef } from "../pack-install.js";
import { resolveBackendManifest } from "../resolve-backend.js";

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
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      try {
        const content = fs.readFileSync(resolvedPath, "utf-8");
        const parsed = matter(content);
        const scope = typeof parsed.data.scope === "string" ? parsed.data.scope : null;
        const severity = typeof parsed.data.severity === "string" ? parsed.data.severity : "soft";
        const action = typeof parsed.data.action === "string" ? parsed.data.action : "None";

        if (!scope) {
          console.error(chalk.red(`Error: Rule is missing required "scope" field in frontmatter.`));
          throw new BpError("Command failed", 1, "CMD_ERROR", "");
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

        // Stage 1: evaluate the declarative check against the real repository
        if (parsed.data.check === undefined || parsed.data.check === null) {
          console.log(chalk.blue("ℹ manual — bp cannot evaluate this rule automatically."));
          console.log(
            chalk.dim("  Add a 'check' to the frontmatter to make this rule enforceable.\n")
          );
          return;
        }

        const checkParse = CheckSchema.safeParse(parsed.data.check);
        if (!checkParse.success) {
          const issue = checkParse.error.issues[0];
          console.error(
            chalk.red(
              `✗ [RULE_CHECK_INVALID] check.${issue?.path.join(".") || "(root)"}: ${issue?.message ?? "malformed check"}`
            )
          );
          throw new BpError("Command failed", EXIT_CODES.STRUCTURAL_FAILURE, "CMD_ERROR", "");
        }

        const fingerprint = await detect(cwd);
        const outcome = await evaluateCheck(checkParse.data as Check, {
          projectRoot: cwd,
          fingerprint,
          fileBudget: defaultResourceBudget(),
        });

        if (outcome.unsupported) {
          console.log(chalk.blue(`ℹ manual — ${outcome.detail}`));
          console.log();
          return;
        }

        if (outcome.passed) {
          console.log(chalk.green(`✔ PASS: ${outcome.detail}`));
        } else if (severity === "hard") {
          console.error(chalk.red(`✗ FAIL (hard): ${outcome.detail}`));
        } else {
          console.warn(chalk.yellow(`⚠ FAIL (soft): ${outcome.detail}`));
        }
        for (const ev of (outcome.evidence ?? []).slice(0, 10)) {
          console.log(chalk.dim(`    - ${ev.line ? `${ev.file}:${ev.line}` : ev.file}`));
        }
        console.log();

        if (!outcome.passed && severity === "hard") {
          throw new BpError("Rule check failed", EXIT_CODES.STRUCTURAL_FAILURE, "CMD_ERROR", "");
        }
        return;
      } catch (e) {
        if (e instanceof BpError) throw e;
        console.error(chalk.red(`Rule test failed: ${normalizeError(e).message}`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }
    });

  cmd
    .command("lint <file>")
    .description("Check rule syntax and scope pattern")
    .action(async (file: string) => {
      const resolvedPath = path.resolve(file);
      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`Error: File does not exist: ${file}`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      const cwd = process.cwd();
      const projectConfig = loadProjectConfig(cwd);
      const userConfig = loadUserConfig();
      const backend = projectConfig?.backend ?? userConfig.default_backend;

      try {
        const fingerprint = await detect(cwd);
        const pack = resolveTemplatePack(fingerprint, backend);
        const manifest = pack.manifest;

        const structuralErrors = await validateStructural(resolvedPath, manifest);
        const semanticErrors = await validateSemantic([resolvedPath], {
          projectRoot: cwd,
          manifest,
        });

        const allErrors = [...structuralErrors, ...semanticErrors];

        // Stage 1: validate the declarative check, when present
        try {
          const content = fs.readFileSync(resolvedPath, "utf-8");
          const parsed = matter(content);
          if (parsed.data.check !== undefined && parsed.data.check !== null) {
            const checkParse = CheckSchema.safeParse(parsed.data.check);
            if (!checkParse.success) {
              const issue = checkParse.error.issues[0];
              const lines = content.split("\n");
              const checkLine = lines.findIndex((l) => /^check\s*:/.test(l));
              allErrors.push({
                file: resolvedPath,
                ...(checkLine >= 0 ? { line: checkLine + 1 } : {}),
                type: "RULE_CHECK_INVALID",
                severity: "error",
                message: `Invalid check at '${issue?.path.join(".") || "(root)"}': ${issue?.message ?? "malformed check"}`,
                resolution:
                  "Fix the 'check' frontmatter to conform to the Check schema (see docs/data-models.md)",
              });
            }
          }
        } catch {
          // unreadable/unparsable files already reported by the structural layer
        }

        if (allErrors.length === 0) {
          console.log(
            chalk.green(`✔ [ PASS ] Rule "${file}" is fully valid and conforms to backend spec.`)
          );
          return;
        }

        console.log(chalk.bold.red(`\nRule "${file}" has validation issues:\n`));
        for (const err of allErrors) {
          formatRuleError(err);
        }

        const hasErrors = allErrors.some((e) => e.severity === "error");
        if (hasErrors)
          throw new BpError("Command failed", EXIT_CODES.STRUCTURAL_FAILURE, "CMD_ERROR", "");
      } catch (e) {
        if (e instanceof BpError) throw e;
        console.error(chalk.red(`Lint error: ${normalizeError(e).message}`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
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
      return;
    });

  // Rule pack management (Stage 2: client-authored packs, see docs/rule-packs.md)
  registerPackCommands(cmd);

  cmd
    .command("install <framework>")
    .description("Install a built-in compliance rule pack (gdpr, soc2, hipaa)")
    .option("--dry-run", "Preview what would be installed without writing files")
    .option("--json", "Output result as JSON")
    .action(async (framework: string, options: { dryRun?: boolean; json?: boolean }) => {
      const { BUILTIN_RULE_PACKS, installRulePack } = await import(
        "../../ecosystem/rule-library.js"
      );

      const pack = BUILTIN_RULE_PACKS[framework.toLowerCase()];
      if (!pack) {
        const available = Object.keys(BUILTIN_RULE_PACKS).join(", ");
        console.error(chalk.red(`Unknown framework: ${framework}. Available: ${available}`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      if (options.dryRun) {
        const preview = {
          framework,
          rules: pack.rules.map((r) => r.id),
          skills: pack.skills.map((s) => s.name),
        };
        if (options.json) {
          console.log(JSON.stringify(preview, null, 2));
        } else {
          console.log(chalk.bold(`\n[dry-run] Would install ${pack.name}:\n`));
          console.log(chalk.cyan(`Rules (${pack.rules.length}):`));
          for (const r of pack.rules) console.log(`  - ${r.id}`);
          console.log(chalk.cyan(`\nSkills (${pack.skills.length}):`));
          for (const s of pack.skills) console.log(`  - ${s.name}`);
        }
        return;
      }

      try {
        const cwd = process.cwd();
        installRulePack(framework.toLowerCase(), cwd);

        if (options.json) {
          console.log(
            JSON.stringify({
              installed: framework,
              rules: pack.rules.length,
              skills: pack.skills.length,
            })
          );
        } else {
          console.log(
            chalk.green(
              `✅ Installed ${pack.name} (${pack.rules.length} rules, ${pack.skills.length} skills)`
            )
          );
          console.log(chalk.dim(`  Rules → .claude/rules/`));
          console.log(chalk.dim(`  Skills → .claude/skills/`));
        }
      } catch (e) {
        console.error(chalk.red(`Install failed: ${normalizeError(e).message}`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }
    });

  return cmd;
}

// ---------------------------------------------------------------------------
// Pack lifecycle subcommands (Stage 2)
// ---------------------------------------------------------------------------

function packCreateTemplate(id: string): string {
  const name = id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `# bp rule pack — format reference: docs/rule-packs.md
# Lint with:    bp rule pack:lint .bp/packs/${id}.bp-pack.yaml
# Install with: bp rule pack:install ${id}
schema: bp-pack/1
id: ${id}
name: ${name}
version: 0.1.0
kind: rules
framework: custom # gdpr | soc2 | hipaa | pci-dss | iso-27001 | custom
description: Describe what this pack enforces
author: your-team@example.com
tags: []
rules:
  # One entry per rule. 'check' is optional — rules without one are manual.
  - id: example-no-console
    scope: "src/**/*.ts"
    severity: soft # hard = error on violation, soft = warning
    action: "Avoid console.log in source files"
    rationale: "Use the structured logger instead"
    check: # machine-evaluable condition (see docs/data-models.md)
      type: content-absent
      glob: "src/**/*.ts"
      pattern: "console\\\\.log\\\\("
`;
}

interface PackCliRule {
  id: string;
  scope: string;
  severity: "hard" | "soft";
  action: string;
  rationale?: string;
  tags?: string[];
  check?: unknown;
  enforcement?: "auto" | "manual";
}

async function harvestRulesFromGlob(cwd: string, glob: string): Promise<PackCliRule[]> {
  const files = await fg(glob, { cwd, onlyFiles: true, dot: true, absolute: true });
  const rules: PackCliRule[] = [];
  for (const file of files.sort()) {
    let data: Record<string, unknown>;
    try {
      data = matter(fs.readFileSync(file, "utf-8")).data as Record<string, unknown>;
    } catch {
      console.warn(chalk.yellow(`  ⚠ Skipping unparsable rule file: ${file}`));
      continue;
    }
    const id =
      typeof data.id === "string" ? data.id : path.basename(file, ".md").replace(/^pack-/, "");
    if (typeof data.scope !== "string" || typeof data.action !== "string") {
      console.warn(chalk.yellow(`  ⚠ Skipping ${file}: missing scope or action frontmatter`));
      continue;
    }
    const rule: PackCliRule = {
      id,
      scope: data.scope,
      severity: data.severity === "hard" ? "hard" : "soft",
      action: data.action,
    };
    if (typeof data.rationale === "string") rule.rationale = data.rationale;
    if (Array.isArray(data.tags)) rule.tags = data.tags.map(String);
    if (data.check !== undefined && data.check !== null) rule.check = data.check;
    if (data.enforcement === "auto" || data.enforcement === "manual")
      rule.enforcement = data.enforcement;
    rules.push(rule);
  }
  return rules;
}

function registerPackCommands(cmd: Command): void {
  cmd
    .command("pack:create <id>")
    .description("Scaffold a new rule pack in .bp/packs/")
    .option("--from-rules <glob>", "Harvest existing rule files' frontmatter into the pack")
    .option("--force", "Overwrite an existing pack file", false)
    .action(async (id: string, options: { fromRules?: string; force?: boolean }) => {
      const { PROJECT_PACKS_DIR, RulePackSchema } = await import("../../packs/schema.js");
      const yaml = (await import("js-yaml")).default;

      if (!/^[a-z0-9_-]+$/i.test(id) || id.length > 64) {
        console.error(chalk.red(`Error: invalid pack id '${id}' (allowed: [a-z0-9_-], max 64)`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      const cwd = process.cwd();
      const target = path.join(cwd, PROJECT_PACKS_DIR, `${id}.bp-pack.yaml`);
      if (fs.existsSync(target) && !options.force) {
        console.error(chalk.red(`Error: pack file already exists: ${target} (use --force)`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      let content: string;
      if (options.fromRules) {
        const rules = await harvestRulesFromGlob(cwd, options.fromRules);
        if (rules.length === 0) {
          console.error(
            chalk.red(`Error: no harvestable rules matched glob: ${options.fromRules}`)
          );
          throw new BpError("Command failed", 1, "CMD_ERROR", "");
        }
        const packData = {
          schema: "bp-pack/1",
          id,
          name: id,
          version: "0.1.0",
          kind: "rules",
          framework: "custom",
          description: `Pack harvested from ${options.fromRules}`,
          author: "unknown",
          tags: [],
          rules,
        };
        const parsed = RulePackSchema.safeParse(packData);
        if (!parsed.success) {
          console.error(chalk.red("Error: harvested rules do not form a valid pack:"));
          for (const issue of parsed.error.issues) {
            console.error(chalk.red(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`));
          }
          throw new BpError("Command failed", 1, "CMD_ERROR", "");
        }
        content = yaml.dump(parsed.data, { lineWidth: 120, sortKeys: false });
      } else {
        content = packCreateTemplate(id);
      }

      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, "utf-8");
      console.log(chalk.green(`✓ Created ${path.relative(cwd, target)}`));
      console.log(
        chalk.dim(`  Edit it, then run: bp rule pack:lint ${path.relative(cwd, target)}`)
      );
    });

  cmd
    .command("pack:lint <path>")
    .description("Validate a pack file (schema, duplicate ids, per-rule checks)")
    .option("--json", "Output result as JSON", false)
    .action(async (packPath: string, options: { json?: boolean }) => {
      const { loadPackFromFile } = await import("../../packs/store.js");
      try {
        const { pack } = await loadPackFromFile(packPath);
        const summary = {
          valid: true,
          id: pack.id,
          version: pack.version,
          rules: pack.rules.length,
          auto_enforceable: pack.rules.filter((r) => r.check !== undefined).length,
        };
        if (options.json) {
          console.log(JSON.stringify(summary, null, 2));
        } else {
          console.log(chalk.green(`✔ [ PASS ] Pack '${pack.id}' v${pack.version} is valid.`));
          console.log(
            chalk.dim(
              `  ${summary.rules} rule(s), ${summary.auto_enforceable} auto-enforceable check(s)`
            )
          );
        }
      } catch (e) {
        const err = e instanceof BpError ? e : new BpError(String(e), 1, "PACK_INVALID", "");
        if (options.json) {
          console.log(
            JSON.stringify({ valid: false, code: err.code, message: err.message }, null, 2)
          );
        } else {
          console.error(chalk.red(`✗ ${err.message}`));
          if (err.resolution) console.error(chalk.yellow(`  → ${err.resolution}`));
        }
        throw new BpError("Pack lint failed", 1, err.code, err.resolution);
      }
    });

  cmd
    .command("pack:install <ref>")
    .description(
      "Install a rule pack (built-in id, project pack id, file path, https/github artifact ref, or registry id)"
    )
    .option("--force", "Replace this pack's own generated files (never touches others)", false)
    .option("--dry-run", "Preview without writing files", false)
    .option("--allow-unsigned", "Accept an unsigned remote artifact (recorded in lockfile)", false)
    .action(
      async (
        ref: string,
        options: { force?: boolean; dryRun?: boolean; allowUnsigned?: boolean }
      ) => {
        const { resolvePack, assertNoBuiltinCollision } = await import("../../packs/store.js");
        const { installPackToProject } = await import("../../packs/materialize.js");
        const { isArtifactRef } = await import("../../registry/client.js");

        const cwd = process.cwd();

        // Stage 5: remote signed artifacts (and registry ids when nothing
        // local matches) go through the verified install pipeline.
        if (isArtifactRef(ref)) {
          await installArtifactRef(ref, "rules", options);
          return;
        }

        const loaded = await resolvePack(ref, cwd);
        if (!loaded && !ref.includes("/") && !ref.includes(path.sep)) {
          // Bare id with no local match: try the configured registry index.
          const { loadUserConfig } = await import("../../config/user.js");
          if (loadUserConfig().registry_url) {
            await installArtifactRef(ref, "rules", options);
            return;
          }
        }
        if (!loaded) {
          console.error(chalk.red(`Error: rule pack not found: ${ref}`));
          console.error(chalk.dim("  Run 'bp rule pack:list' to see available packs."));
          throw new BpError("Command failed", 1, "PACK_NOT_FOUND", "");
        }

        if (loaded.pack.kind !== "rules") {
          console.error(chalk.red(`Error: '${loaded.pack.id}' is a '${loaded.pack.kind}' pack`));
          console.error(chalk.dim("  Install skill packs with 'bp skill pack:install'."));
          throw new BpError("Command failed", 1, "PACK_WRONG_KIND", "");
        }

        if (loaded.source !== "built-in" && !options.force) {
          assertNoBuiltinCollision(loaded.pack);
        }

        const manifest = await resolveBackendManifest(cwd);
        const result = await installPackToProject(loaded, {
          projectRoot: cwd,
          manifest,
          force: options.force ?? false,
          dryRun: options.dryRun ?? false,
        });

        const verb = options.dryRun ? "[dry-run] Would install" : "Installed";
        console.log(
          chalk.green(
            `✓ ${verb} pack '${loaded.pack.id}' v${loaded.pack.version} (${loaded.source})`
          )
        );
        for (const f of result.written) console.log(chalk.green(`  + ${f}`));
        for (const f of result.skipped) console.log(chalk.dim(`  = ${f} (kept existing)`));
        for (const f of result.conflicts)
          console.warn(
            chalk.yellow(`  ! ${f} belongs to another pack or is hand-written; skipped`)
          );
        if (!options.dryRun) console.log(chalk.dim("  Lockfile updated: .bp/packs.lock.json"));

        const semanticWarnings = result.semantic.filter((e) => e.severity !== "info");
        if (semanticWarnings.length > 0) {
          console.warn(chalk.yellow("\n  Scope sanity findings:"));
          for (const w of semanticWarnings) {
            console.warn(chalk.yellow(`  ⚠ [${w.type}] ${w.file}: ${w.message}`));
          }
        }
      }
    );

  cmd
    .command("pack:remove <id>")
    .description("Remove a pack's generated rule files and lockfile entry")
    .option("--force", "Remove even if generated files were hand-edited", false)
    .action(async (id: string, options: { force?: boolean }) => {
      const { removePack } = await import("../../packs/materialize.js");
      const result = await removePack(id, {
        projectRoot: process.cwd(),
        force: options.force ?? false,
      });
      console.log(chalk.green(`✓ Removed pack '${id}'`));
      for (const f of result.removed) console.log(chalk.green(`  - ${f}`));
      for (const f of result.missing) console.log(chalk.dim(`  ? ${f} (already missing)`));
    });

  cmd
    .command("pack:list")
    .description("List built-in, project, and installed rule packs")
    .action(async () => {
      const { BUILT_IN_PACKS } = await import("../../rule-library/packs.js");
      const { loadProjectPacks } = await import("../../packs/store.js");
      const { loadPackLock } = await import("../../packs/materialize.js");

      const cwd = process.cwd();
      const { packs: allProjectPacks, failures } = await loadProjectPacks(cwd);
      const projectPacks = allProjectPacks.filter(({ pack }) => pack.kind === "rules");
      const lock = await loadPackLock(cwd);
      const installed = new Map(lock.installed.map((e) => [e.id, e]));

      console.log(chalk.bold("Built-in packs:\n"));
      for (const pack of BUILT_IN_PACKS) {
        const mark = installed.has(pack.id) ? chalk.green(" [installed]") : "";
        console.log(chalk.cyan(`  ${pack.id}`) + mark);
        console.log(`    ${pack.name} v${pack.version} — ${pack.rules.length} rules`);
      }

      console.log(chalk.bold("\nProject packs (.bp/packs/):\n"));
      if (projectPacks.length === 0 && failures.length === 0) {
        console.log(chalk.dim("  (none — create one with 'bp rule pack:create <id>')"));
      }
      for (const { pack } of projectPacks) {
        const mark = installed.has(pack.id) ? chalk.green(" [installed]") : "";
        console.log(chalk.cyan(`  ${pack.id}`) + mark);
        console.log(`    ${pack.name} v${pack.version} — ${pack.rules.length} rules`);
      }
      for (const failure of failures) {
        console.warn(chalk.yellow(`  ⚠ ${failure.path}: invalid pack file`));
      }

      const installedRulePacks = lock.installed.filter((e) => e.kind === "rules");
      if (installedRulePacks.length > 0) {
        console.log(chalk.bold("\nInstalled (from .bp/packs.lock.json):\n"));
        for (const entry of installedRulePacks) {
          console.log(
            `  ${chalk.cyan(entry.id)} v${entry.version} — ${entry.rules_count} rules (${entry.source})`
          );
        }
      }
      console.log("");
    });

  cmd
    .command("pack:info <ref>")
    .description("Show details about a rule pack (built-in id, project id, or file path)")
    .action(async (ref: string) => {
      const { resolvePack } = await import("../../packs/store.js");
      const loaded = await resolvePack(ref, process.cwd());
      if (!loaded) {
        console.error(chalk.red(`Error: Rule pack not found: ${ref}`));
        throw new BpError("Command failed", 1, "PACK_NOT_FOUND", "");
      }
      const { pack } = loaded;
      console.log(chalk.bold(`${pack.name} (${pack.id})`));
      console.log(`Source: ${loaded.source}${loaded.path ? ` (${loaded.path})` : ""}`);
      console.log(`Version: ${pack.version}`);
      console.log(`Framework: ${pack.framework}`);
      console.log(`Author: ${pack.author}`);
      console.log(`Description: ${pack.description}`);
      console.log(`Rules: ${pack.rules.length}`);
      console.log(`Tags: ${pack.tags.join(", ")}`);
      if (pack.metadata?.coverage !== undefined) {
        // Stage 6 honesty: static coverage is a claim, not a measurement.
        console.log(`Coverage: ${pack.metadata.coverage}% ${chalk.dim("— declared (unverified)")}`);
      }

      // Measured posture when the pack is installed here (Stage 6).
      try {
        const { loadPackLock } = await import("../../packs/materialize.js");
        const lock = await loadPackLock(process.cwd());
        if (lock.installed.some((e) => e.id === pack.id)) {
          const { detect } = await import("../../detector/index.js");
          const { resolveTemplatePack } = await import("../../templater/selector.js");
          const { validateEnforcementDetailed } = await import("../../validator/enforcement.js");
          const { loadProjectConfig } = await import("../../config/project.js");
          const { loadUserConfig } = await import("../../config/user.js");
          const backend =
            loadProjectConfig(process.cwd())?.backend ?? loadUserConfig().default_backend;
          const fingerprint = await detect(process.cwd());
          const templatePack = resolveTemplatePack(fingerprint, backend);
          const result = await validateEnforcementDetailed(
            process.cwd(),
            templatePack.manifest,
            fingerprint
          );
          const mine = result.outcomes.filter((o) => o.pack?.id === pack.id);
          if (mine.length > 0) {
            const passCount = mine.filter((o) => o.status === "pass").length;
            const failCount = mine.filter(
              (o) => o.status === "fail" || o.status === "invalid"
            ).length;
            const manualCount = mine.filter((o) => o.status === "manual").length;
            console.log(
              `Measured: ${chalk.green(`${passCount} pass`)}, ${
                failCount > 0 ? chalk.red(`${failCount} fail`) : "0 fail"
              }, ${chalk.dim(`${manualCount} manual`)} ${chalk.dim("(run `bp report` for detail)")}`
            );
          }
        }
      } catch {
        // measurement is best-effort; pack metadata above is still useful
      }
      console.log("");
      console.log(chalk.bold("Rules:"));
      for (const rule of pack.rules) {
        const enforce = rule.check ? "auto" : "manual";
        console.log(`  - ${rule.id} (${rule.severity}, ${enforce})`);
        if (rule.rationale) {
          console.log(`    ${rule.rationale}`);
        }
      }
    });

  cmd
    .command("pack:search <query>")
    .description("Search built-in and project rule packs by name, description, or tags")
    .action(async (query: string) => {
      const { createRuleLibraryManager } = await import("../../rule-library/manager.js");
      const { loadProjectPacks } = await import("../../packs/store.js");

      const manager = createRuleLibraryManager();
      const lowerQuery = query.toLowerCase();
      const { packs: projectPacks } = await loadProjectPacks(process.cwd());

      const results = [
        ...manager.searchPacks(query).map((pack) => ({ pack, source: "built-in" as const })),
        ...projectPacks
          .filter(
            ({ pack }) =>
              pack.name.toLowerCase().includes(lowerQuery) ||
              pack.description.toLowerCase().includes(lowerQuery) ||
              pack.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
          )
          .map(({ pack }) => ({ pack, source: "project" as const })),
      ];

      // Stage 5: consult the configured signed registry index, best-effort.
      const registryMatches: Array<{
        id: string;
        version: string;
        description?: string | undefined;
      }> = [];
      const { loadUserConfig } = await import("../../config/user.js");
      const registryUrl = loadUserConfig().registry_url;
      if (registryUrl) {
        try {
          const { fetchRegistryIndex } = await import("../../registry/client.js");
          const index = await fetchRegistryIndex(registryUrl);
          for (const entry of index.packs) {
            if (entry.kind !== "rules") continue;
            const haystack = [entry.id, entry.description ?? "", ...(entry.tags ?? [])]
              .join(" ")
              .toLowerCase();
            if (haystack.includes(lowerQuery)) registryMatches.push(entry);
          }
        } catch (e) {
          console.warn(
            chalk.yellow(`  ⚠ registry index unavailable: ${normalizeError(e).message}`)
          );
        }
      }

      if (results.length === 0 && registryMatches.length === 0) {
        console.log(chalk.yellow(`No rule packs found matching: ${query}`));
        return;
      }
      console.log(chalk.bold(`Found ${results.length + registryMatches.length} pack(s):\n`));
      for (const { pack, source } of results) {
        console.log(chalk.cyan(`  ${pack.id}`) + chalk.dim(` (${source})`));
        console.log(`    ${pack.description}`);
      }
      for (const entry of registryMatches) {
        console.log(chalk.cyan(`  ${entry.id}`) + chalk.dim(` v${entry.version} (registry)`));
        if (entry.description) console.log(`    ${entry.description}`);
      }
    });
}
