import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSkillCommand } from "../../../src/cli/commands/skill.js";
import { BpError } from "../../../src/errors.js";
import { EXIT_CODES } from "../../../src/validator/index.js";

let tmpDir: string;
let prevCwd: string;

const VALID_SKILL_PACK_YAML = `schema: bp-pack/1
id: acme-skills
name: ACME Skills
version: 1.0.0
kind: skills
framework: custom
description: House skills
author: platform@acme.test
tags: []
skills:
  - name: endpoint-smoke
    description: Verify a deployment is healthy
    when_to_use: After every production deploy
    tools_required: [read_file, run_command]
    risk: low
    procedure: |
      ## Procedure
      1. Check the health endpoint.
      2. Tail the error logs.
`;

function write(rel: string, content: string): string {
  const file = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf-8");
  return file;
}

async function run(...args: string[]): Promise<void> {
  await createSkillCommand().parseAsync(args, { from: "user" });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-skill-cli-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(path.join(tmpDir, "README.md"), "# Fixture\n");
  prevCwd = process.cwd();
  process.chdir(tmpDir);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("bp skill new", () => {
  it("scaffolds a skill that passes lint by construction (acceptance 1)", async () => {
    await run("new", "deploy-check", "--tools", "read_file,run_command", "--risk", "low");
    const file = path.join(tmpDir, ".claude/skills/deploy-check.md");
    expect(fs.existsSync(file)).toBe(true);

    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("name: deploy-check");
    expect(content).toContain("risk: low");
    expect(content).toContain("bp_source: scaffolded");
    expect(content).toContain("## Procedure");
    expect(content).toContain("<!-- bp:preserve -->");

    await expect(run("lint")).resolves.toBeUndefined();
  });

  it("refuses invalid names", async () => {
    await expect(run("new", "Not A Slug")).rejects.toBeInstanceOf(BpError);
  });

  it("refuses unknown tools", async () => {
    await expect(run("new", "x", "--tools", "teleport")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "SKILL_UNKNOWN_TOOL"
    );
  });

  it("refuses invalid risk tiers", async () => {
    await expect(run("new", "x", "--risk", "extreme")).rejects.toBeInstanceOf(BpError);
  });

  it("refuses name collisions (acceptance 1)", async () => {
    await run("new", "deploy-check");
    await expect(run("new", "deploy-check")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "SKILL_NAME_COLLISION"
    );
    // Collision via frontmatter name in a differently-named file:
    fs.renameSync(
      path.join(tmpDir, ".claude/skills/deploy-check.md"),
      path.join(tmpDir, ".claude/skills/renamed.md")
    );
    await expect(run("new", "deploy-check")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "SKILL_NAME_COLLISION"
    );
  });
});

describe("bp skill lint", () => {
  it("exits with SEMANTIC_FAILURE when a skill is invalid (acceptance 1)", async () => {
    await run("new", "deploy-check");
    const file = path.join(tmpDir, ".claude/skills/deploy-check.md");
    const broken = fs
      .readFileSync(file, "utf-8")
      .split("\n")
      .filter((l) => !l.startsWith("when_to_use:"))
      .join("\n");
    fs.writeFileSync(file, broken, "utf-8");

    await expect(run("lint")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.exitCode === EXIT_CODES.SEMANTIC_FAILURE
    );
  });

  it("flags SKILL_UNKNOWN_TOOL for tools outside the claude capability list (acceptance 2)", async () => {
    await run("new", "deploy-check");
    const file = path.join(tmpDir, ".claude/skills/deploy-check.md");
    fs.writeFileSync(
      file,
      fs.readFileSync(file, "utf-8").replace("tools_required: []", "tools_required: [teleport]"),
      "utf-8"
    );
    await expect(run("lint")).rejects.toBeInstanceOf(BpError);
  });

  it("supports --json", async () => {
    await run("new", "deploy-check");
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });
    await run("lint", "--json");
    const parsed = JSON.parse(logs.join(""));
    expect(parsed.valid).toBe(true);
    expect(parsed.files).toBe(1);
  });
});

describe("bp skill list", () => {
  it("reports provenance: scaffolded, pack, manual", async () => {
    await run("new", "deploy-check");
    write(
      ".claude/skills/handwritten.md",
      "---\nname: handwritten\ndescription: d\nwhen_to_use: w\ntools_required: []\n---\n1. step\n"
    );
    write(".bp/packs/acme-skills.bp-pack.yaml", VALID_SKILL_PACK_YAML);
    await run("pack:install", "acme-skills");

    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });
    await run("list", "--json");
    const rows = JSON.parse(logs.join("")) as Array<{ name: string; source: string }>;
    const sources = Object.fromEntries(rows.map((r) => [r.name, r.source]));
    expect(sources["deploy-check"]).toBe("scaffolded");
    expect(sources.handwritten).toBe("manual");
    // The pack-installed copy carries pack provenance (entry id wins over name)
    expect(Object.values(sources)).toContain("pack:acme-skills");
  });
});

describe("bp skill test", () => {
  it("round-trips through a backend and exits 0 when lossless (acceptance 4)", async () => {
    await run("new", "deploy-check", "--tools", "read_file,run_command", "--risk", "low");
    await expect(
      run("test", ".claude/skills/deploy-check.md", "--backend", "cursor")
    ).resolves.toBeUndefined();
  });

  it("fails on unknown tools against a declared capability list", async () => {
    write(
      ".claude/skills/tele.md",
      "---\nname: tele\ndescription: d\nwhen_to_use: w\ntools_required: [teleport]\n---\n1. step\n"
    );
    await expect(run("test", ".claude/skills/tele.md")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.exitCode === EXIT_CODES.SEMANTIC_FAILURE
    );
  });
});

describe("bp skill pack:* lifecycle (acceptance 3)", () => {
  it("pack:create scaffolds a pack that passes pack:lint", async () => {
    await run("pack:create", "my-skills");
    const file = path.join(tmpDir, ".bp/packs/my-skills.bp-pack.yaml");
    expect(fs.existsSync(file)).toBe(true);
    await expect(run("pack:lint", file)).resolves.toBeUndefined();
  });

  it("pack:lint rejects rule packs", async () => {
    write(
      ".bp/packs/rules.bp-pack.yaml",
      'schema: bp-pack/1\nid: rulesy\nname: R\nversion: 1.0.0\nkind: rules\nframework: custom\ndescription: d\nauthor: a\nrules:\n  - id: r\n    scope: "**/*"\n    severity: soft\n    action: x\n'
    );
    await expect(run("pack:lint", ".bp/packs/rules.bp-pack.yaml")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_WRONG_KIND"
    );
  });

  it("installs, locks, and removes a skill pack cleanly", async () => {
    write(".bp/packs/acme-skills.bp-pack.yaml", VALID_SKILL_PACK_YAML);
    await run("pack:install", "acme-skills");

    const installed = path.join(tmpDir, ".claude/skills/pack-acme-skills-endpoint-smoke.md");
    expect(fs.existsSync(installed)).toBe(true);

    const lock = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".bp/packs.lock.json"), "utf-8")
    ) as { installed: Array<{ id: string; kind: string; skills_count: number }> };
    expect(lock.installed[0]).toMatchObject({
      id: "acme-skills",
      kind: "skills",
      skills_count: 1,
    });

    // Installed skills pass `bp skill lint` (under the bp validation umbrella).
    await expect(run("lint")).resolves.toBeUndefined();

    await run("pack:remove", "acme-skills");
    expect(fs.existsSync(installed)).toBe(false);
    const lockAfter = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".bp/packs.lock.json"), "utf-8")
    ) as { installed: unknown[] };
    expect(lockAfter.installed).toHaveLength(0);
  });

  it("pack:install rejects rule packs with guidance", async () => {
    write(
      ".bp/packs/rulesy.bp-pack.yaml",
      'schema: bp-pack/1\nid: rulesy\nname: R\nversion: 1.0.0\nkind: rules\nframework: custom\ndescription: d\nauthor: a\nrules:\n  - id: r\n    scope: "**/*"\n    severity: soft\n    action: x\n'
    );
    await expect(run("pack:install", "rulesy")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_WRONG_KIND"
    );
  });
});
