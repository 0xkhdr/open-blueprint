import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BlueprintIR } from "../../../src/plugin/index.js";
import {
  activePluginLevels,
  buildFileInventory,
  deepFreeze,
  diagnosticType,
  makeValidationContext,
  type PluginDiagnostic,
  type PluginRunPayload,
  prepareContextData,
} from "../../../src/plugins/context.js";
import type { BackendManifest } from "../../../src/templater/selector.js";

function makeIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: { project_name: "t", surface: "", temporal_anchor: "", conventions: [] },
    personas: [],
    rules: [{ id: "r1", scope: "**/*", severity: "hard", action: "do" }],
    skills: [],
    hooks: [],
    meta: {
      rule_precedence: [],
      conflict_resolution: "",
      source_backend: "claude",
      target_backend: "claude",
    },
  } as BlueprintIR;
}

const manifest = {
  file_patterns: {
    anchor: ["CLAUDE.md"],
    rules: ".claude/rules/*.md",
    skills: ".claude/skills/*.md",
    agents: ".claude/agents/*.md",
    hooks: ".claude/hooks/*",
  },
} as unknown as BackendManifest;

function makePayload(): PluginRunPayload {
  return {
    blueprint: makeIR(),
    files: [
      {
        path: "/repo/.claude/rules/r1.md",
        layer: "rules",
        frontmatter: { severity: "hard" },
        body: "Body",
        fieldLines: { severity: 3 },
      },
    ],
    levels: ["structural", "semantic"],
  };
}

describe("activePluginLevels", () => {
  it("maps 'all' to every plugin level", () => {
    expect(activePluginLevels("all")).toEqual([
      "structural",
      "semantic",
      "logical",
      "enforcement",
    ]);
  });
  it("includes structural alongside the requested level", () => {
    expect(activePluginLevels("logical")).toEqual(["structural", "logical"]);
    expect(activePluginLevels("structural")).toEqual(["structural"]);
  });
  it("returns no levels for drift/governance", () => {
    expect(activePluginLevels("drift")).toEqual([]);
    expect(activePluginLevels("governance")).toEqual([]);
  });
});

describe("diagnosticType", () => {
  it("builds PLUGIN_<NAME>_<ID> in upper snake case", () => {
    expect(diagnosticType("acme-checks", "require-rationale")).toBe(
      "PLUGIN_ACME_CHECKS_REQUIRE_RATIONALE"
    );
  });
  it("strips non-alphanumerics", () => {
    expect(diagnosticType("a.b", "_x_")).toBe("PLUGIN_A_B_X");
  });
});

describe("deepFreeze / prepareContextData", () => {
  it("freezes nested payload data", () => {
    const data = prepareContextData(makePayload());
    expect(Object.isFrozen(data.blueprint)).toBe(true);
    expect(Object.isFrozen(data.blueprint.rules)).toBe(true);
    expect(Object.isFrozen(data.blueprint.rules[0])).toBe(true);
    expect(Object.isFrozen(data.files)).toBe(true);
    expect(Object.isFrozen(data.files[0]?.frontmatter)).toBe(true);
  });

  it("throws on mutation attempts in strict mode", () => {
    const data = prepareContextData(makePayload());
    expect(() => {
      "use strict";
      (data.blueprint.rules as unknown as unknown[]).push({});
    }).toThrow();
  });

  it("handles cyclic objects without infinite recursion", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => deepFreeze(cyclic)).not.toThrow();
    expect(Object.isFrozen(cyclic)).toBe(true);
  });
});

describe("makeValidationContext", () => {
  it("exposes lineOf from the serialized field line map", () => {
    const data = prepareContextData(makePayload());
    const ctx = makeValidationContext(data, "v1", []);
    expect(ctx.files[0]?.lineOf("severity")).toBe(3);
    expect(ctx.files[0]?.lineOf("missing")).toBeUndefined();
  });

  it("tags diagnostics with the validator id and severity", () => {
    const sink: PluginDiagnostic[] = [];
    const ctx = makeValidationContext(prepareContextData(makePayload()), "v1", sink);
    ctx.error("a.md", 4, "bad", "fix it");
    ctx.warn("b.md", undefined, "meh");
    ctx.info("c.md", "fyi");
    expect(sink).toHaveLength(3);
    expect(sink[0]).toMatchObject({
      file: "a.md",
      line: 4,
      severity: "error",
      message: "bad",
      resolution: "fix it",
      validatorId: "v1",
    });
    expect(sink[1]?.severity).toBe("warning");
    expect(sink[1]?.line).toBeUndefined();
    expect(sink[2]?.severity).toBe("info");
  });
});

describe("buildFileInventory", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-plugin-ctx-"));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("classifies layers and extracts frontmatter with line numbers", async () => {
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    const ruleFile = path.join(rulesDir, "no-secrets.md");
    fs.writeFileSync(
      ruleFile,
      '---\nscope: "**/*"\nseverity: hard\naction: "no secrets"\n---\n\nBody text\n',
      "utf-8"
    );
    const anchorFile = path.join(tmpDir, "CLAUDE.md");
    fs.writeFileSync(anchorFile, "# Project\n", "utf-8");

    const inventory = await buildFileInventory(tmpDir, manifest, [ruleFile, anchorFile]);
    expect(inventory).toHaveLength(2);

    const rule = inventory.find((f) => f.path === ruleFile);
    expect(rule?.layer).toBe("rules");
    expect(rule?.frontmatter.severity).toBe("hard");
    expect(rule?.fieldLines.severity).toBe(3);
    expect(rule?.body.trim()).toBe("Body text");

    const anchor = inventory.find((f) => f.path === anchorFile);
    expect(anchor?.layer).toBe("anchor");
    expect(anchor?.fieldLines).toEqual({});
  });

  it("skips unreadable files", async () => {
    const inventory = await buildFileInventory(tmpDir, manifest, [
      path.join(tmpDir, "does-not-exist.md"),
    ]);
    expect(inventory).toEqual([]);
  });
});
