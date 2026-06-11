import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BpError } from "../../../src/errors.js";
import {
  canonicalPackHash,
  governedContentHash,
  installPackToProject,
  loadPackLock,
  packRuleFileName,
  removePack,
  renderRuleFile,
} from "../../../src/rule-library/materialize.js";
import type { RulePack } from "../../../src/rule-library/schema.js";
import type { LoadedPack } from "../../../src/rule-library/store.js";
import type { BackendManifest } from "../../../src/templater/selector.js";

const manifest: BackendManifest = {
  backend: "claude",
  version: "test",
  supported_features: { anchors: true, rules: true, skills: true, agents: true, hooks: true },
  file_patterns: {
    anchor: ["CLAUDE.md"],
    rules: ".claude/rules/*.md",
    skills: ".claude/skills/*.md",
    agents: ".claude/agents/*.md",
    hooks: ".claude/hooks/*",
  },
  max_file_sizes: { anchor: 5000, rules: 10000, skills: 15000, agents: 8000 },
  frontmatter_schema: {
    rules: {
      required: ["scope", "severity"],
      optional: ["action", "rationale", "tags", "id", "check", "enforcement"],
      severity_values: ["hard", "soft"],
    },
    skills: { required: ["name", "description"], optional: [] },
    agents: { required: ["name"], optional: [] },
  },
};

function makePack(): RulePack {
  return {
    schema: "bp-pack/1",
    id: "acme",
    name: "ACME Internal",
    version: "1.0.0",
    kind: "rules",
    framework: "custom",
    description: "House rules",
    author: "platform@acme.test",
    tags: ["security"],
    rules: [
      {
        id: "no-console",
        scope: "src/**/*.ts",
        severity: "hard",
        action: "No console.log",
        rationale: "Use the logger",
        check: { type: "content-absent", glob: "src/**/*.ts", pattern: "console\\.log\\(" },
      },
      { id: "docs-required", scope: "**/*", severity: "soft", action: "Keep README updated" },
    ],
  };
}

function loadedPack(pack: RulePack = makePack()): LoadedPack {
  return { pack, source: "project" };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-materialize-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "src/index.ts"), "export const x = 1;\n");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function ruleFilePath(ruleId: string): string {
  return path.join(tmpDir, ".claude/rules", packRuleFileName("acme", ruleId));
}

describe("renderRuleFile", () => {
  it("emits provenance frontmatter and generated-block markers", () => {
    const pack = makePack();
    const content = renderRuleFile(pack, pack.rules[0]!);
    expect(content).toContain("pack_id: acme");
    expect(content).toContain("pack_version: 1.0.0");
    expect(content).toContain("scope: src/**/*.ts");
    expect(content).toContain("severity: hard");
    expect(content).toContain("check:");
    expect(content).toContain("<!-- bp-generated:begin pack-acme-no-console -->");
    expect(content).toContain("<!-- bp-generated:end pack-acme-no-console -->");
  });
});

describe("canonicalPackHash", () => {
  it("is stable under key reordering", () => {
    const a = makePack();
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as RulePack;
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(a));
    expect(canonicalPackHash(a)).toBe(canonicalPackHash(reordered));
  });

  it("changes when content changes", () => {
    const a = makePack();
    const b = { ...makePack(), version: "1.0.1" };
    expect(canonicalPackHash(a)).not.toBe(canonicalPackHash(b));
  });
});

describe("installPackToProject", () => {
  it("materializes one rule file per rule and writes the lockfile", async () => {
    const result = await installPackToProject(loadedPack(), { projectRoot: tmpDir, manifest });

    expect(result.written.sort()).toEqual([
      ".claude/rules/pack-acme-docs-required.md",
      ".claude/rules/pack-acme-no-console.md",
    ]);
    expect(fs.existsSync(ruleFilePath("no-console"))).toBe(true);

    const lock = await loadPackLock(tmpDir);
    expect(lock.installed).toHaveLength(1);
    const entry = lock.installed[0]!;
    expect(entry.id).toBe("acme");
    expect(entry.rules_count).toBe(2);
    expect(entry.content_hash).toBe(canonicalPackHash(makePack()));
    expect(Object.keys(entry.files)).toHaveLength(2);
  });

  it("is idempotent: second install is a no-op with byte-equal files", async () => {
    await installPackToProject(loadedPack(), { projectRoot: tmpDir, manifest });
    const before = fs.readFileSync(ruleFilePath("no-console"), "utf-8");

    const second = await installPackToProject(loadedPack(), { projectRoot: tmpDir, manifest });
    expect(second.written).toEqual([]);
    expect(second.skipped).toHaveLength(2);
    expect(fs.readFileSync(ruleFilePath("no-console"), "utf-8")).toBe(before);
  });

  it("default re-install keeps existing files even when the pack changed", async () => {
    await installPackToProject(loadedPack(), { projectRoot: tmpDir, manifest });
    const before = fs.readFileSync(ruleFilePath("no-console"), "utf-8");

    const changed = makePack();
    changed.version = "2.0.0";
    await installPackToProject(loadedPack(changed), { projectRoot: tmpDir, manifest });
    expect(fs.readFileSync(ruleFilePath("no-console"), "utf-8")).toBe(before);
  });

  it("--force replaces the pack's own files and preserve blocks survive", async () => {
    await installPackToProject(loadedPack(), { projectRoot: tmpDir, manifest });
    const file = ruleFilePath("no-console");
    const withPreserve = `${fs.readFileSync(file, "utf-8")}\n<!-- bp:preserve -->\nMy local notes.\n<!-- bp:end-preserve -->\n`;
    fs.writeFileSync(file, withPreserve, "utf-8");

    const changed = makePack();
    changed.version = "2.0.0";
    await installPackToProject(loadedPack(changed), { projectRoot: tmpDir, manifest, force: true });

    const after = fs.readFileSync(file, "utf-8");
    expect(after).toContain("pack_version: 2.0.0");
    expect(after).toContain("My local notes.");
  });

  it("--force never touches files owned by another pack", async () => {
    const file = ruleFilePath("no-console");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const foreign = "---\nid: no-console\nscope: '**/*'\nseverity: soft\npack_id: other\n---\nForeign.\n";
    fs.writeFileSync(file, foreign, "utf-8");

    const result = await installPackToProject(loadedPack(), {
      projectRoot: tmpDir,
      manifest,
      force: true,
    });
    expect(result.conflicts).toContain(".claude/rules/pack-acme-no-console.md");
    expect(fs.readFileSync(file, "utf-8")).toBe(foreign);
  });

  it("dry-run writes nothing", async () => {
    const result = await installPackToProject(loadedPack(), {
      projectRoot: tmpDir,
      manifest,
      dryRun: true,
    });
    expect(result.written).toHaveLength(2);
    expect(fs.existsSync(ruleFilePath("no-console"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".bp/packs.lock.json"))).toBe(false);
  });
});

describe("governedContentHash", () => {
  it("ignores preserve-block edits but catches edits outside them", () => {
    const base = "---\nid: x\n---\nbody\n";
    const withPreserve = `${base}<!-- bp:preserve -->\nnotes\n<!-- bp:end-preserve -->\n`;
    expect(governedContentHash(base)).toBe(governedContentHash(withPreserve));
    expect(governedContentHash(base)).not.toBe(governedContentHash(`${base}tampered\n`));
  });
});

describe("removePack", () => {
  it("removes generated files and the lock entry", async () => {
    await installPackToProject(loadedPack(), { projectRoot: tmpDir, manifest });
    const result = await removePack("acme", { projectRoot: tmpDir });

    expect(result.removed).toHaveLength(2);
    expect(fs.existsSync(ruleFilePath("no-console"))).toBe(false);
    expect((await loadPackLock(tmpDir)).installed).toHaveLength(0);
  });

  it("refuses to remove hand-edited files without --force", async () => {
    await installPackToProject(loadedPack(), { projectRoot: tmpDir, manifest });
    fs.appendFileSync(ruleFilePath("no-console"), "\nTampered outside preserve.\n");

    await expect(removePack("acme", { projectRoot: tmpDir })).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_FILE_MODIFIED"
    );
    expect(fs.existsSync(ruleFilePath("no-console"))).toBe(true);
  });

  it("--force removes even hand-edited files", async () => {
    await installPackToProject(loadedPack(), { projectRoot: tmpDir, manifest });
    fs.appendFileSync(ruleFilePath("no-console"), "\nTampered.\n");

    const result = await removePack("acme", { projectRoot: tmpDir, force: true });
    expect(result.removed).toHaveLength(2);
    expect(fs.existsSync(ruleFilePath("no-console"))).toBe(false);
  });

  it("tolerates preserve-block additions during removal", async () => {
    await installPackToProject(loadedPack(), { projectRoot: tmpDir, manifest });
    fs.appendFileSync(
      ruleFilePath("no-console"),
      "\n<!-- bp:preserve -->\nLocal notes.\n<!-- bp:end-preserve -->\n"
    );

    const result = await removePack("acme", { projectRoot: tmpDir });
    expect(result.removed).toHaveLength(2);
  });

  it("throws PACK_NOT_INSTALLED for unknown packs", async () => {
    await expect(removePack("ghost", { projectRoot: tmpDir })).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_NOT_INSTALLED"
    );
  });
});
