import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type OverrideAuditEntry,
  mergeBlueprints,
  writeOverrideAudit,
} from "../../../src/ecosystem/inheritance.js";
import type { BlueprintIR, Persona, Rule, Skill } from "../../../src/translator/ir.js";

const baseAnchor = {
  project_name: "base",
  surface: "claude",
  temporal_anchor: "2026-01-01",
  conventions: [],
};

function makeIR(
  rules: Rule[] = [],
  skills: Skill[] = [],
  personas: Persona[] = [],
  extra: Partial<BlueprintIR> = {}
): BlueprintIR {
  return {
    spatial_anchor: baseAnchor,
    personas,
    rules,
    skills,
    hooks: [],
    meta: {},
    ...extra,
  };
}

const ruleBase: Rule = { id: "r1", scope: "src/**/*", severity: "hard", action: "base action" };
const ruleOverride: Rule = {
  id: "r1",
  scope: "src/**/*",
  severity: "soft",
  action: "override action",
};
const ruleNew: Rule = { id: "r2", scope: "tests/**/*", severity: "soft", action: "new rule" };

const skillBase: Skill = {
  name: "s1",
  description: "base skill",
  when_to_use: "always",
  procedure: "base",
};
const skillOverride: Skill = {
  name: "s1",
  description: "overridden skill",
  when_to_use: "always",
  procedure: "override",
};
const skillNew: Skill = {
  name: "s2",
  description: "new skill",
  when_to_use: "sometimes",
  procedure: "new",
};

const personaBase: Persona = {
  name: "p1",
  role: "engineer",
  reasoning_style: "analytical",
  constraints: [],
};
const personaOverride: Persona = {
  name: "p1",
  role: "senior-engineer",
  reasoning_style: "analytical",
  constraints: [],
};

describe("mergeBlueprints - deep strategy", () => {
  it("merges rules by id — override wins", () => {
    const base = makeIR([ruleBase]);
    const override = makeIR([ruleOverride]);
    const audit: OverrideAuditEntry[] = [];
    const result = mergeBlueprints(base, override, "deep", audit);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].action).toBe("override action");
  });

  it("keeps base rules not in override", () => {
    const base = makeIR([ruleBase, ruleNew]);
    const override = makeIR([ruleOverride]);
    const result = mergeBlueprints(base, override, "deep");
    expect(result.rules).toHaveLength(2);
  });

  it("adds new override rules not in base", () => {
    const base = makeIR([ruleBase]);
    const override = makeIR([ruleNew]);
    const result = mergeBlueprints(base, override, "deep");
    const ids = result.rules.map((r) => r.id);
    expect(ids).toContain("r1");
    expect(ids).toContain("r2");
  });

  it("merges skills by name — override wins", () => {
    const base = makeIR([], [skillBase]);
    const override = makeIR([], [skillOverride]);
    const result = mergeBlueprints(base, override, "deep");
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].description).toBe("overridden skill");
  });

  it("adds new override skills not in base", () => {
    const base = makeIR([], [skillBase]);
    const override = makeIR([], [skillNew]);
    const result = mergeBlueprints(base, override, "deep");
    expect(result.skills).toHaveLength(2);
  });

  it("merges personas by name — override wins", () => {
    const base = makeIR([], [], [personaBase]);
    const override = makeIR([], [], [personaOverride]);
    const result = mergeBlueprints(base, override, "deep");
    expect(result.personas).toHaveLength(1);
    expect(result.personas[0].role).toBe("senior-engineer");
  });

  it("overrides settings entirely", () => {
    const base = makeIR([], [], [], { settings: { approval_mode: "auto" } });
    const override = makeIR([], [], [], { settings: { approval_mode: "confirm" } });
    const result = mergeBlueprints(base, override, "deep");
    expect(result.settings?.approval_mode).toBe("confirm");
  });

  it("keeps base settings when override has none", () => {
    const base = makeIR([], [], [], { settings: { approval_mode: "auto" } });
    const override = makeIR();
    const result = mergeBlueprints(base, override, "deep");
    expect(result.settings?.approval_mode).toBe("auto");
  });
});

describe("mergeBlueprints - shallow strategy", () => {
  it("shallow merge: override replaces all top-level fields", () => {
    const base = makeIR([ruleBase]);
    const override = makeIR([ruleNew]);
    const result = mergeBlueprints(base, override, "shallow");
    expect(result.rules).toEqual([ruleNew]);
  });
});

describe("mergeBlueprints - override strategy", () => {
  it("override strategy returns override IR verbatim", () => {
    const base = makeIR([ruleBase, ruleNew]);
    const override = makeIR([ruleOverride]);
    const result = mergeBlueprints(base, override, "override");
    expect(result).toBe(override);
  });
});

describe("mergeBlueprints - audit trail", () => {
  it("records audit entry when rule is overridden", () => {
    const base = makeIR([ruleBase]);
    const override = makeIR([ruleOverride]);
    const audit: OverrideAuditEntry[] = [];
    mergeBlueprints(base, override, "deep", audit);
    expect(audit).toHaveLength(1);
    expect(audit[0].path).toBe("rules.r1");
  });

  it("audit entry has timestamp", () => {
    const base = makeIR([ruleBase]);
    const override = makeIR([ruleOverride]);
    const audit: OverrideAuditEntry[] = [];
    mergeBlueprints(base, override, "deep", audit);
    expect(audit[0].timestamp).toBeTruthy();
    expect(new Date(audit[0].timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("records old_value and new_value", () => {
    const base = makeIR([ruleBase]);
    const override = makeIR([ruleOverride]);
    const audit: OverrideAuditEntry[] = [];
    mergeBlueprints(base, override, "deep", audit);
    expect(audit[0].old_value).toBeDefined();
    expect(audit[0].new_value).toBeDefined();
  });

  it("records skill override in audit", () => {
    const base = makeIR([], [skillBase]);
    const override = makeIR([], [skillOverride]);
    const audit: OverrideAuditEntry[] = [];
    mergeBlueprints(base, override, "deep", audit);
    expect(audit.some((e) => e.path.includes("skills.s1"))).toBe(true);
  });

  it("does not record audit when rule is new (not overriding)", () => {
    const base = makeIR([ruleBase]);
    const override = makeIR([ruleNew]);
    const audit: OverrideAuditEntry[] = [];
    mergeBlueprints(base, override, "deep", audit);
    expect(audit).toHaveLength(0);
  });
});

describe("writeOverrideAudit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-audit-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes .bp-override-audit.yaml file", () => {
    const audit: OverrideAuditEntry[] = [
      {
        timestamp: "2026-01-01T00:00:00.000Z",
        source: "override",
        target: "merged",
        path: "rules.r1",
        old_value: ruleBase,
        new_value: ruleOverride,
      },
    ];
    writeOverrideAudit(audit, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, ".bp-override-audit.yaml"))).toBe(true);
  });

  it("audit file contains overrides key", () => {
    const audit: OverrideAuditEntry[] = [
      {
        timestamp: "2026-01-01T00:00:00.000Z",
        source: "override",
        target: "merged",
        path: "rules.r1",
        old_value: ruleBase,
        new_value: ruleOverride,
      },
    ];
    writeOverrideAudit(audit, tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, ".bp-override-audit.yaml"), "utf-8");
    expect(content).toContain("overrides:");
  });

  it("audit file contains timestamp", () => {
    const audit: OverrideAuditEntry[] = [
      {
        timestamp: "2026-05-29T00:00:00.000Z",
        source: "override",
        target: "merged",
        path: "rules.r1",
        old_value: null,
        new_value: null,
      },
    ];
    writeOverrideAudit(audit, tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, ".bp-override-audit.yaml"), "utf-8");
    expect(content).toContain("2026-05-29T00:00:00.000Z");
  });

  it("audit file contains path", () => {
    const audit: OverrideAuditEntry[] = [
      {
        timestamp: "2026-01-01T00:00:00.000Z",
        source: "override",
        target: "merged",
        path: "rules.my-rule",
        old_value: null,
        new_value: null,
      },
    ];
    writeOverrideAudit(audit, tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, ".bp-override-audit.yaml"), "utf-8");
    expect(content).toContain("rules.my-rule");
  });

  it("writes empty overrides for empty audit", () => {
    writeOverrideAudit([], tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, ".bp-override-audit.yaml"), "utf-8");
    expect(content).toContain("overrides:");
  });
});
