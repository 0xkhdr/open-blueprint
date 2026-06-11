import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installPackToProject } from "../../../src/rule-library/materialize.js";
import type { RulePack } from "../../../src/rule-library/schema.js";
import type { BackendManifest } from "../../../src/templater/selector.js";
import { validatePackIntegrity } from "../../../src/validator/pack-integrity.js";

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

const pack: RulePack = {
  schema: "bp-pack/1",
  id: "acme",
  name: "ACME",
  version: "1.0.0",
  kind: "rules",
  framework: "custom",
  description: "House rules",
  author: "x@acme.test",
  tags: [],
  rules: [{ id: "docs", scope: "**/*", severity: "soft", action: "Keep docs fresh" }],
};

let tmpDir: string;
const ruleFile = () => path.join(tmpDir, ".claude/rules/pack-acme-docs.md");

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-pack-integrity-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "fixture" }));
  await installPackToProject({ pack, source: "project" }, { projectRoot: tmpDir, manifest });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("validatePackIntegrity", () => {
  it("is clean right after install", async () => {
    expect(await validatePackIntegrity(tmpDir)).toEqual([]);
  });

  it("is clean when no lockfile exists", async () => {
    fs.rmSync(path.join(tmpDir, ".bp/packs.lock.json"));
    expect(await validatePackIntegrity(tmpDir)).toEqual([]);
  });

  it("flags missing generated files as PACK_FILE_MISSING warnings", async () => {
    fs.rmSync(ruleFile());
    const errors = await validatePackIntegrity(tmpDir);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("PACK_FILE_MISSING");
    expect(errors[0]?.severity).toBe("warning");
  });

  it("flags hand-edited files as PACK_FILE_MODIFIED warnings", async () => {
    fs.appendFileSync(ruleFile(), "\nEdited outside preserve.\n");
    const errors = await validatePackIntegrity(tmpDir);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("PACK_FILE_MODIFIED");
    expect(errors[0]?.severity).toBe("warning");
  });

  it("tolerates preserve-block additions", async () => {
    fs.appendFileSync(ruleFile(), "\n<!-- bp:preserve -->\nNotes.\n<!-- bp:end-preserve -->\n");
    expect(await validatePackIntegrity(tmpDir)).toEqual([]);
  });

  it("reports a corrupted lockfile as an error", async () => {
    fs.writeFileSync(path.join(tmpDir, ".bp/packs.lock.json"), "{not json");
    const errors = await validatePackIntegrity(tmpDir);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("PACK_LOCK_INVALID");
    expect(errors[0]?.severity).toBe("error");
  });
});
