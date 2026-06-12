/**
 * `bp skill` — client-created skills (Stage 3, GAP-3): author, lint, list,
 * dry-run, and share skills as packs through the Stage 2 pack machinery.
 *
 * Skills authored here are canonical (`SkillSchema` frontmatter + procedure
 * body) and flow through the same validation `bp verify` runs, so client
 * skills sit under the bp governance umbrella from the moment they exist.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import fg from "fast-glob";
import matter from "gray-matter";
import { BpError } from "../../errors.js";
import type { BackendManifest } from "../../templater/selector.js";
import type { Skill } from "../../translator/ir.js";
import { patternToDir } from "../../translator/serialize.js";
import {
  parseSkillMarkdown,
  renderSkillMarkdown,
  slugifySkillName,
} from "../../translator/skill-file.js";
import { canonicalToBackend, toCanonical } from "../../translator/tools.js";
import type { ValidationError } from "../../types/validation.js";
import { normalizeError } from "../../utils/errors.js";
import { EXIT_CODES } from "../../validator/index.js";
import { validateSkillFiles } from "../../validator/skills.js";
import { installArtifactRef } from "../pack-install.js";
import { resolveBackendManifest, resolveBackendName } from "../resolve-backend.js";

const SKILL_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;
const RISK_VALUES = ["low", "medium", "high"] as const;

function fail(message: string, code = "CMD_ERROR", resolution = ""): never {
  console.error(chalk.red(`Error: ${message}`));
  if (resolution) console.error(chalk.dim(`  → ${resolution}`));
  throw new BpError(message, 1, code, resolution);
}

function formatFinding(err: ValidationError): void {
  const loc = err.line ? `:${err.line}` : "";
  const rel = path.relative(process.cwd(), err.file) || err.file;
  if (err.severity === "error") {
    console.error(chalk.red(`  ✗ [${err.type}] ${rel}${loc}`));
    console.error(chalk.red(`    ${err.message}`));
    console.error(chalk.yellow(`    → ${err.resolution}`));
  } else if (err.severity === "warning") {
    console.warn(chalk.yellow(`  ⚠ [${err.type}] ${rel}${loc}`));
    console.warn(chalk.yellow(`    ${err.message}`));
    console.warn(chalk.dim(`    → ${err.resolution}`));
  } else {
    console.log(chalk.blue(`  ℹ [${err.type}] ${rel}${loc}: ${err.message}`));
  }
}

function skillsDirFromManifest(manifest: BackendManifest): string {
  if (!manifest.supported_features.skills || !manifest.file_patterns.skills) {
    fail(
      `backend '${manifest.backend}' does not support skill files`,
      "SKILL_UNSUPPORTED_BACKEND",
      "Pick a backend with skill support via --backend (e.g. claude, cursor, generic)"
    );
  }
  return patternToDir(manifest.file_patterns.skills).dir;
}

async function globSkillFiles(cwd: string, pattern: string): Promise<string[]> {
  const files = await fg(pattern, {
    cwd,
    onlyFiles: true,
    dot: true,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });
  return files.sort();
}

/** Provenance of a skill file: scaffolded | pack:<id> | manual. */
function skillSource(frontmatter: Record<string, unknown>): string {
  if (typeof frontmatter.pack_id === "string") return `pack:${frontmatter.pack_id}`;
  if (frontmatter.bp_source === "scaffolded") return "scaffolded";
  return "manual";
}

// ---------------------------------------------------------------------------
// Scaffolding
// ---------------------------------------------------------------------------

const SCAFFOLD_BODY = `## Procedure

1. Describe the first concrete step the agent should take.
2. Replace these placeholder steps with the exact procedure.
3. State how the agent verifies the result.

<!-- bp:preserve -->
Team-specific notes go here — they survive regeneration.
<!-- bp:end-preserve -->`;

interface NewOptions {
  description?: string;
  tools?: string;
  risk?: string;
  backend?: string;
}

async function skillNew(name: string, options: NewOptions): Promise<void> {
  if (!SKILL_NAME_RE.test(name) || name.length > 64) {
    fail(
      `invalid skill name '${name}' (allowed: [a-z0-9_-], must start alphanumeric, max 64)`,
      "SKILL_INVALID_NAME",
      "Use a slug like 'deploy-check'"
    );
  }
  if (options.risk !== undefined && !RISK_VALUES.includes(options.risk as never)) {
    fail(`invalid --risk '${options.risk}' (allowed: ${RISK_VALUES.join(", ")})`);
  }

  const cwd = process.cwd();
  const manifest = await resolveBackendManifest(cwd, options.backend);
  const skillsDir = skillsDirFromManifest(manifest);

  const tools = (options.tools ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  for (const tool of tools) {
    if (toCanonical(tool, manifest.backend) === undefined) {
      fail(
        `unknown tool '${tool}'`,
        "SKILL_UNKNOWN_TOOL",
        "Use the canonical vocabulary (read_file, write_file, edit_file, run_command, run_tests, search, web_fetch, mcp:<tool>)"
      );
    }
  }

  // Collision check: target file plus any existing skill claiming the name/id.
  const target = path.join(cwd, skillsDir, `${name}.md`);
  if (fs.existsSync(target)) {
    fail(
      `skill file already exists: ${path.relative(cwd, target)}`,
      "SKILL_NAME_COLLISION",
      "Pick another name or edit the existing skill"
    );
  }
  for (const file of await globSkillFiles(cwd, manifest.file_patterns.skills)) {
    let data: Record<string, unknown>;
    try {
      data = matter(fs.readFileSync(file, "utf-8")).data as Record<string, unknown>;
    } catch {
      // Unparsable neighbors are lint's problem, not a scaffold blocker.
      continue;
    }
    const existingName = typeof data.name === "string" ? data.name : "";
    const existingId = typeof data.id === "string" ? data.id : slugifySkillName(existingName);
    if (existingName === name || existingId === name) {
      fail(
        `skill '${name}' already defined in ${path.relative(cwd, file)}`,
        "SKILL_NAME_COLLISION",
        "Pick another name or edit the existing skill"
      );
    }
  }

  const skill: Skill = {
    name,
    description: options.description ?? `TODO: describe what the '${name}' skill accomplishes`,
    when_to_use: `TODO: state the concrete situation that should trigger '${name}'`,
    tools_required: tools,
    procedure: SCAFFOLD_BODY,
    disable_model_invocation: false,
    ...(options.risk !== undefined ? { risk: options.risk as Skill["risk"] } : {}),
  };

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderSkillMarkdown(skill, { bp_source: "scaffolded" }), "utf-8");

  console.log(chalk.green(`✓ Created ${path.relative(cwd, target)}`));
  console.log(chalk.dim(`  Edit it, then run: bp skill lint ${path.relative(cwd, target)}`));
}

// ---------------------------------------------------------------------------
// Lint
// ---------------------------------------------------------------------------

async function skillLint(
  glob: string | undefined,
  options: { json?: boolean; backend?: string }
): Promise<void> {
  const cwd = process.cwd();
  const manifest = await resolveBackendManifest(cwd, options.backend);
  const pattern = glob ?? manifest.file_patterns.skills;
  if (!pattern) fail(`backend '${manifest.backend}' declares no skills location`);

  const files = await globSkillFiles(cwd, pattern);
  const findings = await validateSkillFiles(files, { projectRoot: cwd, manifest });
  const errors = findings.filter((f) => f.severity === "error");

  if (options.json) {
    console.log(
      JSON.stringify({ valid: errors.length === 0, files: files.length, findings }, null, 2)
    );
  } else if (findings.length === 0) {
    console.log(chalk.green(`✔ [ PASS ] ${files.length} skill file(s) valid (${pattern})`));
  } else {
    console.log(chalk.bold(`\nSkill lint findings (${files.length} file(s)):\n`));
    for (const finding of findings) formatFinding(finding);
    if (errors.length === 0) console.log(chalk.green("\n✔ No errors (warnings only)."));
  }

  if (errors.length > 0) {
    throw new BpError("Skill lint failed", EXIT_CODES.SEMANTIC_FAILURE, "SKILL_LINT_FAILED", "");
  }
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

async function skillList(options: { json?: boolean; backend?: string }): Promise<void> {
  const cwd = process.cwd();
  const manifest = await resolveBackendManifest(cwd, options.backend);
  const pattern = manifest.file_patterns.skills;
  const files = pattern ? await globSkillFiles(cwd, pattern) : [];

  const rows = files.flatMap((file) => {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const data = matter(raw).data as Record<string, unknown>;
      return [
        {
          name: typeof data.name === "string" ? data.name : path.basename(file, ".md"),
          risk: typeof data.risk === "string" ? data.risk : "-",
          tools: Array.isArray(data.tools_required) ? data.tools_required.map(String) : [],
          source: skillSource(data),
          file: path.relative(cwd, file),
        },
      ];
    } catch {
      return [];
    }
  });

  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (rows.length === 0) {
    console.log(chalk.dim("No skills found. Create one with 'bp skill new <name>'."));
    return;
  }

  const widths = {
    name: Math.max(4, ...rows.map((r) => r.name.length)),
    risk: Math.max(4, ...rows.map((r) => r.risk.length)),
    source: Math.max(6, ...rows.map((r) => r.source.length)),
  };
  console.log(
    chalk.bold(
      `${"NAME".padEnd(widths.name)}  ${"RISK".padEnd(widths.risk)}  ${"SOURCE".padEnd(widths.source)}  TOOLS / FILE`
    )
  );
  for (const row of rows) {
    const tools = row.tools.length > 0 ? row.tools.join(",") : "-";
    console.log(
      `${row.name.padEnd(widths.name)}  ${row.risk.padEnd(widths.risk)}  ${row.source.padEnd(widths.source)}  ${tools}  ${chalk.dim(row.file)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Test (static dry-run + translator round-trip)
// ---------------------------------------------------------------------------

async function skillTest(file: string, options: { backend?: string }): Promise<void> {
  const cwd = process.cwd();
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) fail(`file does not exist: ${file}`);

  const backend = resolveBackendName(cwd, options.backend);
  const manifest = await resolveBackendManifest(cwd, options.backend);
  const skill = parseSkillMarkdown(fs.readFileSync(resolved, "utf-8"), path.basename(file, ".md"));

  console.log(chalk.bold.cyan(`\n🧪 bp skill test — ${skill.name} → ${backend}\n`));

  // 1. Tool resolution (canonical → backend alias)
  if (skill.tools_required.length === 0) {
    console.log(chalk.dim("Tools   : (none declared)"));
  } else {
    console.log(chalk.bold("Tools:"));
    for (const tool of skill.tools_required) {
      const canonical = toCanonical(tool, backend);
      if (canonical === undefined) {
        console.log(chalk.red(`  ✗ ${tool} — not in the canonical vocabulary`));
      } else {
        console.log(`  ${tool} → ${chalk.cyan(canonicalToBackend(canonical, backend))}`);
      }
    }
  }
  console.log();

  // 2. Static validation against the target backend (capabilities, stale
  //    paths, procedure quality) — same checks bp verify runs.
  const findings = await validateSkillFiles([resolved], { projectRoot: cwd, manifest });
  for (const finding of findings) formatFinding(finding);
  const errors = findings.filter((f) => f.severity === "error");
  if (findings.length === 0) console.log(chalk.green("✔ Static checks passed."));
  console.log();

  // 3. Translator round-trip: prove the skill survives render→parse.
  const { roundTripSkill } = await import("../../translator/fidelity.js");
  try {
    const result = await roundTripSkill(skill, backend);
    if (result.warnings.length === 0) {
      console.log(chalk.green(`✔ Round-trip through '${backend}' is lossless.`));
    } else {
      console.warn(chalk.yellow(`⚠ Fidelity loss translating to '${backend}':`));
      for (const warning of result.warnings) {
        console.warn(chalk.yellow(`  - ${warning.message}`));
      }
    }
  } catch (e) {
    fail(
      `round-trip failed for backend '${backend}': ${normalizeError(e).message}`,
      "SKILL_ROUNDTRIP_FAILED",
      "Check the backend name (bp skill test <file> --backend claude|cursor|generic|…)"
    );
  }
  console.log();

  if (errors.length > 0) {
    throw new BpError("Skill test failed", EXIT_CODES.SEMANTIC_FAILURE, "SKILL_TEST_FAILED", "");
  }
}

// ---------------------------------------------------------------------------
// Skill packs (Stage 2 machinery, kind: skills)
// ---------------------------------------------------------------------------

function skillPackTemplate(id: string): string {
  const name = id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `# bp skill pack — format reference: docs/skill-authoring.md
# Lint with:    bp skill pack:lint .bp/packs/${id}.bp-pack.yaml
# Install with: bp skill pack:install ${id}
schema: bp-pack/1
id: ${id}
name: ${name}
version: 0.1.0
kind: skills
framework: custom
description: Describe what this skill pack teaches the agent
author: your-team@example.com
tags: []
skills:
  - name: example-skill
    description: Add an integration test for an HTTP endpoint
    when_to_use: When a new endpoint lacks integration coverage
    tools_required: [read_file, write_file, run_tests]
    risk: low
    procedure: |
      ## Procedure
      1. Locate the route handler for the endpoint.
      2. Write a request/response test next to existing integration tests.
      3. Run the test suite and confirm the new test passes.
`;
}

function registerPackCommands(cmd: Command): void {
  cmd
    .command("pack:create <id>")
    .description("Scaffold a new skill pack in .bp/packs/")
    .option("--force", "Overwrite an existing pack file", false)
    .action(async (id: string, options: { force?: boolean }) => {
      const { PROJECT_PACKS_DIR } = await import("../../packs/schema.js");
      if (!/^[a-z0-9_-]+$/i.test(id) || id.length > 64) {
        fail(`invalid pack id '${id}' (allowed: [a-z0-9_-], max 64)`);
      }
      const cwd = process.cwd();
      const target = path.join(cwd, PROJECT_PACKS_DIR, `${id}.bp-pack.yaml`);
      if (fs.existsSync(target) && !options.force) {
        fail(`pack file already exists: ${target} (use --force)`);
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, skillPackTemplate(id), "utf-8");
      console.log(chalk.green(`✓ Created ${path.relative(cwd, target)}`));
      console.log(
        chalk.dim(`  Edit it, then run: bp skill pack:lint ${path.relative(cwd, target)}`)
      );
    });

  cmd
    .command("pack:lint <path>")
    .description("Validate a skill pack file (schema, kind, duplicate skill ids)")
    .option("--json", "Output result as JSON", false)
    .action(async (packPath: string, options: { json?: boolean }) => {
      const { loadPackFromFile } = await import("../../packs/store.js");
      try {
        const { pack } = await loadPackFromFile(packPath);
        if (pack.kind !== "skills") {
          fail(
            `'${pack.id}' is a '${pack.kind}' pack`,
            "PACK_WRONG_KIND",
            "Lint rule packs with 'bp rule pack:lint'"
          );
        }
        const summary = {
          valid: true,
          id: pack.id,
          version: pack.version,
          skills: pack.skills.length,
        };
        if (options.json) {
          console.log(JSON.stringify(summary, null, 2));
        } else {
          console.log(chalk.green(`✔ [ PASS ] Skill pack '${pack.id}' v${pack.version} is valid.`));
          console.log(chalk.dim(`  ${summary.skills} skill(s)`));
        }
      } catch (e) {
        const err = e instanceof BpError ? e : new BpError(String(e), 1, "PACK_INVALID", "");
        if (options.json) {
          console.log(
            JSON.stringify({ valid: false, code: err.code, message: err.message }, null, 2)
          );
        } else if (err.code !== "PACK_WRONG_KIND") {
          console.error(chalk.red(`✗ ${err.message}`));
          if (err.resolution) console.error(chalk.yellow(`  → ${err.resolution}`));
        }
        throw new BpError("Pack lint failed", 1, err.code, err.resolution);
      }
    });

  cmd
    .command("pack:install <ref>")
    .description(
      "Install a skill pack (project pack id, file path, https/github artifact ref, or registry id)"
    )
    .option("--force", "Replace this pack's own generated files (never touches others)", false)
    .option("--dry-run", "Preview without writing files", false)
    .option("--allow-unsigned", "Accept an unsigned remote artifact (recorded in lockfile)", false)
    .option("--backend <backend>", "Target backend (default: project config)")
    .action(
      async (
        ref: string,
        options: { force?: boolean; dryRun?: boolean; backend?: string; allowUnsigned?: boolean }
      ) => {
        const { resolvePack, assertNoBuiltinCollision } = await import("../../packs/store.js");
        const { installPackToProject } = await import("../../packs/materialize.js");
        const { isArtifactRef } = await import("../../registry/client.js");

        const cwd = process.cwd();

        // Stage 5: remote signed artifacts go through the verified pipeline.
        if (isArtifactRef(ref)) {
          await installArtifactRef(ref, "skills", options);
          return;
        }

        const loaded = await resolvePack(ref, cwd);
        if (!loaded && !ref.includes("/") && !ref.includes(path.sep)) {
          const { loadUserConfig } = await import("../../config/user.js");
          if (loadUserConfig().registry_url) {
            await installArtifactRef(ref, "skills", options);
            return;
          }
        }
        if (!loaded) {
          fail(`skill pack not found: ${ref}`, "PACK_NOT_FOUND", "Run 'bp skill pack:list'");
        }
        if (loaded.pack.kind !== "skills") {
          fail(
            `'${loaded.pack.id}' is a '${loaded.pack.kind}' pack`,
            "PACK_WRONG_KIND",
            "Install rule packs with 'bp rule pack:install'"
          );
        }
        if (loaded.source !== "built-in" && !options.force) {
          assertNoBuiltinCollision(loaded.pack);
        }

        const manifest = await resolveBackendManifest(cwd, options.backend);
        const result = await installPackToProject(loaded, {
          projectRoot: cwd,
          manifest,
          force: options.force ?? false,
          dryRun: options.dryRun ?? false,
        });

        const verb = options.dryRun ? "[dry-run] Would install" : "Installed";
        console.log(
          chalk.green(
            `✓ ${verb} skill pack '${loaded.pack.id}' v${loaded.pack.version} (${loaded.source})`
          )
        );
        for (const f of result.written) console.log(chalk.green(`  + ${f}`));
        for (const f of result.skipped) console.log(chalk.dim(`  = ${f} (kept existing)`));
        for (const f of result.conflicts)
          console.warn(
            chalk.yellow(`  ! ${f} belongs to another pack or is hand-written; skipped`)
          );
        if (!options.dryRun) console.log(chalk.dim("  Lockfile updated: .bp/packs.lock.json"));

        const semanticFindings = result.semantic.filter((e) => e.severity !== "info");
        if (semanticFindings.length > 0) {
          console.warn(chalk.yellow("\n  Validation findings:"));
          for (const w of semanticFindings) {
            console.warn(chalk.yellow(`  ⚠ [${w.type}] ${w.file}: ${w.message}`));
          }
        }
      }
    );

  cmd
    .command("pack:remove <id>")
    .description("Remove a skill pack's generated files and lockfile entry")
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
    .description("List project and installed skill packs")
    .action(async () => {
      const { loadProjectPacks } = await import("../../packs/store.js");
      const { loadPackLock } = await import("../../packs/materialize.js");

      const cwd = process.cwd();
      const { packs: projectPacks, failures } = await loadProjectPacks(cwd);
      const lock = await loadPackLock(cwd);
      const skillPacks = projectPacks.filter(({ pack }) => pack.kind === "skills");
      const installed = new Map(lock.installed.map((e) => [e.id, e]));

      console.log(chalk.bold("Project skill packs (.bp/packs/):\n"));
      if (skillPacks.length === 0) {
        console.log(chalk.dim("  (none — create one with 'bp skill pack:create <id>')"));
      }
      for (const { pack } of skillPacks) {
        const mark = installed.has(pack.id) ? chalk.green(" [installed]") : "";
        console.log(chalk.cyan(`  ${pack.id}`) + mark);
        console.log(`    ${pack.name} v${pack.version} — ${pack.skills.length} skills`);
      }
      for (const failure of failures) {
        console.warn(chalk.yellow(`  ⚠ ${failure.path}: invalid pack file`));
      }

      const installedSkillPacks = lock.installed.filter((e) => e.kind === "skills");
      if (installedSkillPacks.length > 0) {
        console.log(chalk.bold("\nInstalled (from .bp/packs.lock.json):\n"));
        for (const entry of installedSkillPacks) {
          console.log(
            `  ${chalk.cyan(entry.id)} v${entry.version} — ${entry.skills_count} skills (${entry.source})`
          );
        }
      }
      console.log("");
    });
}

// ---------------------------------------------------------------------------
// Command group
// ---------------------------------------------------------------------------

export function createSkillCommand(): Command {
  const cmd = new Command("skill").description(
    "Author, validate, and share skills (governance layer 4)"
  );

  cmd
    .command("new <name>")
    .description("Scaffold a new skill in the active backend's skills directory")
    .option("--description <text>", "What the skill accomplishes")
    .option("--tools <list>", "Comma-separated canonical tools (e.g. read_file,run_tests)")
    .option("--risk <tier>", "Risk tier: low | medium | high")
    .option("--backend <backend>", "Target backend (default: project config)")
    .action(skillNew);

  cmd
    .command("lint [glob]")
    .description("Validate skill files (default: the active backend's skills directory)")
    .option("--json", "Output findings as JSON", false)
    .option("--backend <backend>", "Validate against this backend's capabilities")
    .action(skillLint);

  cmd
    .command("list")
    .description("List skills with risk, tools, and provenance")
    .option("--json", "Output as JSON", false)
    .option("--backend <backend>", "Backend whose skills directory to list")
    .action(skillList);

  cmd
    .command("test <file>")
    .description("Dry-run a skill: tool resolution, capability check, translator round-trip")
    .option("--backend <backend>", "Round-trip against this backend (default: project config)")
    .action(skillTest);

  registerPackCommands(cmd);

  return cmd;
}
