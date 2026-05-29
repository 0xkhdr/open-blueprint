import { describe, it, expect } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import { validateCrossLayerReferences } from "../../../src/validator/cross-layer.js";

const FILE = "/project/.claude/blueprint.json";

function baseIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "test",
      surface: "# test",
      temporal_anchor: "dev",
      conventions: [],
    },
    personas: [{ name: "Agent1", role: "Worker", reasoning_style: "logical", constraints: [] }],
    rules: [],
    skills: [],
    hooks: [],
    meta: {
      rule_precedence: [],
      conflict_resolution: "precedence-based",
      source_backend: "claude",
      target_backend: "claude",
    },
  };
}

describe("validateCrossLayerReferences", () => {
  describe("rule → skill references", () => {
    it("passes with no rules", () => {
      const ir = baseIR();
      expect(validateCrossLayerReferences(ir, FILE)).toHaveLength(0);
    });

    it("passes when rule action has no skill refs", () => {
      const ir = baseIR();
      ir.rules = [{ id: "r1", scope: "**/*.ts", severity: "suggestion", action: "Do something" }];
      expect(validateCrossLayerReferences(ir, FILE)).toHaveLength(0);
    });

    it("passes when [[skill:X]] ref resolves to existing skill", () => {
      const ir = baseIR();
      ir.skills = [{ name: "analyze", description: "d", when_to_use: "w", tools_required: [], procedure: "p" }];
      ir.rules = [{ id: "r1", scope: "**", severity: "suggestion", action: "Run [[skill:analyze]]" }];
      const errors = validateCrossLayerReferences(ir, FILE);
      expect(errors.filter((e) => e.type === "MISSING_SKILL_REFERENCE")).toHaveLength(0);
    });

    it("errors when [[skill:X]] ref is missing", () => {
      const ir = baseIR();
      ir.rules = [{ id: "r1", scope: "**", severity: "suggestion", action: "Run [[skill:ghost]]" }];
      const errors = validateCrossLayerReferences(ir, FILE);
      expect(errors.some((e) => e.type === "MISSING_SKILL_REFERENCE")).toBe(true);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("ghost");
    });

    it("passes when @skill:X ref resolves to existing skill", () => {
      const ir = baseIR();
      ir.skills = [{ name: "lint", description: "d", when_to_use: "w", tools_required: [], procedure: "p" }];
      ir.rules = [{ id: "r1", scope: "**", severity: "suggestion", action: "Use @skill:lint here" }];
      expect(validateCrossLayerReferences(ir, FILE).filter((e) => e.type === "MISSING_SKILL_REFERENCE")).toHaveLength(0);
    });

    it("errors when @skill:X ref is missing", () => {
      const ir = baseIR();
      ir.rules = [{ id: "r1", scope: "**", severity: "suggestion", action: "Use @skill:missing here" }];
      const errors = validateCrossLayerReferences(ir, FILE);
      expect(errors.some((e) => e.type === "MISSING_SKILL_REFERENCE")).toBe(true);
    });

    it("detects multiple missing skill refs in one rule", () => {
      const ir = baseIR();
      ir.rules = [{ id: "r1", scope: "**", severity: "suggestion", action: "[[skill:a]] and [[skill:b]]" }];
      const errors = validateCrossLayerReferences(ir, FILE).filter((e) => e.type === "MISSING_SKILL_REFERENCE");
      expect(errors).toHaveLength(2);
    });

    it("detects missing refs across multiple rules", () => {
      const ir = baseIR();
      ir.rules = [
        { id: "r1", scope: "**", severity: "suggestion", action: "[[skill:x]]" },
        { id: "r2", scope: "**", severity: "suggestion", action: "[[skill:y]]" },
      ];
      const errors = validateCrossLayerReferences(ir, FILE).filter((e) => e.type === "MISSING_SKILL_REFERENCE");
      expect(errors).toHaveLength(2);
    });

    it("includes rule id in error message", () => {
      const ir = baseIR();
      ir.rules = [{ id: "my-rule-42", scope: "**", severity: "suggestion", action: "[[skill:ghost]]" }];
      const errors = validateCrossLayerReferences(ir, FILE);
      expect(errors[0].message).toContain("my-rule-42");
    });
  });

  describe("agent → tool references", () => {
    it("passes when agent has no allowed_tools", () => {
      const ir = baseIR();
      expect(validateCrossLayerReferences(ir, FILE)).toHaveLength(0);
    });

    it("passes for built-in tools", () => {
      const ir = baseIR();
      ir.personas[0].allowed_tools = ["file_read", "file_edit", "terminal", "test_runner"];
      expect(validateCrossLayerReferences(ir, FILE).filter((e) => e.type === "UNKNOWN_TOOL_REFERENCE")).toHaveLength(0);
    });

    it("passes when agent tool matches a skill name", () => {
      const ir = baseIR();
      ir.skills = [{ name: "my-tool", description: "d", when_to_use: "w", tools_required: [], procedure: "p" }];
      ir.personas[0].allowed_tools = ["my-tool"];
      expect(validateCrossLayerReferences(ir, FILE).filter((e) => e.type === "UNKNOWN_TOOL_REFERENCE")).toHaveLength(0);
    });

    it("warns when agent references unknown tool", () => {
      const ir = baseIR();
      ir.personas[0].allowed_tools = ["unknown-tool-xyz"];
      const errors = validateCrossLayerReferences(ir, FILE);
      expect(errors.some((e) => e.type === "UNKNOWN_TOOL_REFERENCE")).toBe(true);
      expect(errors.find((e) => e.type === "UNKNOWN_TOOL_REFERENCE")?.severity).toBe("warning");
    });

    it("warns for each unknown tool in agent", () => {
      const ir = baseIR();
      ir.personas[0].allowed_tools = ["bad1", "bad2"];
      const errors = validateCrossLayerReferences(ir, FILE).filter((e) => e.type === "UNKNOWN_TOOL_REFERENCE");
      expect(errors).toHaveLength(2);
    });

    it("warns across multiple agents", () => {
      const ir = baseIR();
      ir.personas = [
        { name: "A1", role: "r", reasoning_style: "logical", constraints: [], allowed_tools: ["bad-tool"] },
        { name: "A2", role: "r", reasoning_style: "logical", constraints: [], allowed_tools: ["another-bad"] },
      ];
      const errors = validateCrossLayerReferences(ir, FILE).filter((e) => e.type === "UNKNOWN_TOOL_REFERENCE");
      expect(errors).toHaveLength(2);
    });

    it("error message includes agent name and tool name", () => {
      const ir = baseIR();
      ir.personas[0].allowed_tools = ["mystery-tool"];
      const err = validateCrossLayerReferences(ir, FILE).find((e) => e.type === "UNKNOWN_TOOL_REFERENCE");
      expect(err?.message).toContain("Agent1");
      expect(err?.message).toContain("mystery-tool");
    });
  });

  describe("skill → command references", () => {
    it("passes when skill procedure has no command refs", () => {
      const ir = baseIR();
      ir.skills = [{ name: "s1", description: "d", when_to_use: "w", tools_required: [], procedure: "Run tests" }];
      expect(validateCrossLayerReferences(ir, FILE)).toHaveLength(0);
    });

    it("passes when [[command:X]] resolves to existing command", () => {
      const ir = baseIR();
      ir.commands = [{ name: "build", description: "Build project", command: "npm run build" }];
      ir.skills = [{ name: "s1", description: "d", when_to_use: "w", tools_required: [], procedure: "Run [[command:build]]" }];
      expect(validateCrossLayerReferences(ir, FILE).filter((e) => e.type === "UNKNOWN_COMMAND_REFERENCE")).toHaveLength(0);
    });

    it("warns when [[command:X]] ref is missing", () => {
      const ir = baseIR();
      ir.skills = [{ name: "s1", description: "d", when_to_use: "w", tools_required: [], procedure: "Run [[command:deploy]]" }];
      const errors = validateCrossLayerReferences(ir, FILE);
      expect(errors.some((e) => e.type === "UNKNOWN_COMMAND_REFERENCE")).toBe(true);
      expect(errors.find((e) => e.type === "UNKNOWN_COMMAND_REFERENCE")?.severity).toBe("warning");
    });

    it("passes when @command:X resolves to existing command", () => {
      const ir = baseIR();
      ir.commands = [{ name: "lint", description: "Lint", command: "npm run lint" }];
      ir.skills = [{ name: "s1", description: "d", when_to_use: "w", tools_required: [], procedure: "@command:lint" }];
      expect(validateCrossLayerReferences(ir, FILE).filter((e) => e.type === "UNKNOWN_COMMAND_REFERENCE")).toHaveLength(0);
    });

    it("warns when @command:X is missing", () => {
      const ir = baseIR();
      ir.skills = [{ name: "s1", description: "d", when_to_use: "w", tools_required: [], procedure: "@command:ghost-cmd" }];
      const errors = validateCrossLayerReferences(ir, FILE);
      expect(errors.some((e) => e.type === "UNKNOWN_COMMAND_REFERENCE")).toBe(true);
    });

    it("includes skill name and command name in error message", () => {
      const ir = baseIR();
      ir.skills = [{ name: "my-skill", description: "d", when_to_use: "w", tools_required: [], procedure: "[[command:missing-cmd]]" }];
      const err = validateCrossLayerReferences(ir, FILE).find((e) => e.type === "UNKNOWN_COMMAND_REFERENCE");
      expect(err?.message).toContain("my-skill");
      expect(err?.message).toContain("missing-cmd");
    });

    it("handles no commands defined — warns if skill refs commands", () => {
      const ir = baseIR();
      ir.skills = [{ name: "s1", description: "d", when_to_use: "w", tools_required: [], procedure: "[[command:build]]" }];
      expect(validateCrossLayerReferences(ir, FILE).some((e) => e.type === "UNKNOWN_COMMAND_REFERENCE")).toBe(true);
    });
  });

  describe("combined scenarios", () => {
    it("returns all errors from all ref types simultaneously", () => {
      const ir = baseIR();
      ir.rules = [{ id: "r1", scope: "**", severity: "suggestion", action: "[[skill:gone]]" }];
      ir.personas[0].allowed_tools = ["unknown-tool"];
      ir.skills = [{ name: "s1", description: "d", when_to_use: "w", tools_required: [], procedure: "[[command:gone]]" }];
      const errors = validateCrossLayerReferences(ir, FILE);
      expect(errors.some((e) => e.type === "MISSING_SKILL_REFERENCE")).toBe(true);
      expect(errors.some((e) => e.type === "UNKNOWN_TOOL_REFERENCE")).toBe(true);
      expect(errors.some((e) => e.type === "UNKNOWN_COMMAND_REFERENCE")).toBe(true);
    });

    it("uses provided blueprintFile in all errors", () => {
      const ir = baseIR();
      ir.rules = [{ id: "r1", scope: "**", severity: "suggestion", action: "[[skill:gone]]" }];
      const errors = validateCrossLayerReferences(ir, "/custom/path.json");
      expect(errors[0].file).toBe("/custom/path.json");
    });
  });
});
