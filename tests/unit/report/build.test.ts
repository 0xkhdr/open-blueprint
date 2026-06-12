import { describe, expect, it } from "vitest";
import {
  buildGovernanceReport,
  type ReportInputs,
  type ReportPackInput,
} from "../../../src/report/build.js";
import { GovernanceReportSchema, REPORT_SCHEMA_VERSION } from "../../../src/report/model.js";
import type { RuleOutcome } from "../../../src/validator/enforcement.js";

const PROJECT = { name: "demo", root: "/repo", backend: "claude" };

function outcome(partial: Partial<RuleOutcome> & { id: string }): RuleOutcome {
  return {
    file: `/repo/.claude/rules/${partial.id}.md`,
    severity: "hard",
    enforcement: "auto",
    status: "pass",
    ...partial,
  };
}

function packInput(partial: Partial<ReportPackInput> & { id: string }): ReportPackInput {
  return {
    version: "1.0.0",
    source: "project",
    kind: "rules",
    integrity: "ok",
    outdated: false,
    ...partial,
  };
}

describe("buildGovernanceReport", () => {
  it("composes outcomes + packs into a schema-valid bp-report/1 document", () => {
    const inputs: ReportInputs = {
      project: PROJECT,
      outcomes: [
        outcome({ id: "passing", pack: { id: "acme", version: "1.0.0" } }),
        outcome({
          id: "failing-hard",
          status: "fail",
          detail: "0 files matched glob 'SECURITY.md'",
          evidence: [{ file: "src/index.ts", line: 3 }],
          pack: { id: "acme", version: "1.0.0" },
        }),
        outcome({
          id: "manual-rule",
          severity: "soft",
          enforcement: "manual",
          status: "manual",
          scope: "src/**",
        }),
        outcome({ id: "broken", status: "invalid" }),
        outcome({ id: "failing-soft", severity: "soft", status: "fail" }),
      ],
      packs: [
        packInput({
          id: "acme",
          framework: "custom",
          declared_coverage: 80,
          trust: "unsigned-accepted",
        }),
      ],
      skills: [{ name: "deploy", risk: "high", source: "project", valid: true }],
      staleRuleIds: new Set(["manual-rule"]),
      generatedAt: "2026-06-11T00:00:00.000Z",
    };

    const report = buildGovernanceReport(inputs);
    expect(GovernanceReportSchema.parse(report)).toEqual(report);
    expect(report.schema).toBe(REPORT_SCHEMA_VERSION);
    expect(report.generated_at).toBe("2026-06-11T00:00:00.000Z");

    expect(report.summary).toEqual({
      rules_total: 5,
      rules_enforced: 4,
      rules_manual: 1,
      violations_hard: 2, // failing-hard + invalid check
      violations_soft: 1,
      skills_total: 1,
      packs_installed: 1,
      packs_unsigned: 1,
    });

    // pack rows replace declared coverage with measured counts
    const acme = report.packs[0];
    expect(acme?.measured).toEqual({ pass: 1, fail: 1, manual: 0 });
    expect(acme?.declared_coverage).toBe(80);
    expect(acme?.integrity).toBe("ok");

    // file paths are project-relative POSIX
    expect(report.rules[0]?.file).toBe(".claude/rules/passing.md");
    const failing = report.rules.find((r) => r.id === "failing-hard");
    expect(failing?.evidence).toEqual([{ file: "src/index.ts", line: 3 }]);

    const manual = report.rules.find((r) => r.id === "manual-rule");
    expect(manual?.stale).toBe(true);
  });

  it("degrades gracefully: no packs, no skills, no snapshot", () => {
    const report = buildGovernanceReport({
      project: PROJECT,
      outcomes: [outcome({ id: "only-rule" })],
    });

    expect(GovernanceReportSchema.parse(report)).toEqual(report);
    expect(report.packs).toEqual([]);
    expect(report.skills).toBeUndefined();
    expect(report.summary.skills_total).toBeUndefined();
    expect(report.summary.packs_unsigned).toBeUndefined();
    expect(report.summary).toMatchObject({
      rules_total: 1,
      violations_hard: 0,
      violations_soft: 0,
      packs_installed: 0,
    });
    expect(report.rules[0]?.stale).toBeUndefined();
  });

  it("handles an empty repo (no rules at all)", () => {
    const report = buildGovernanceReport({ project: PROJECT, outcomes: [] });
    expect(GovernanceReportSchema.parse(report)).toEqual(report);
    expect(report.summary.rules_total).toBe(0);
    expect(report.rules).toEqual([]);
  });

  it("marks pack integrity straight from the integrity input", () => {
    const report = buildGovernanceReport({
      project: PROJECT,
      outcomes: [],
      packs: [
        packInput({ id: "a", integrity: "modified" }),
        packInput({ id: "b", integrity: "missing", outdated: true }),
      ],
    });
    expect(report.packs.map((p) => p.integrity)).toEqual(["modified", "missing"]);
    expect(report.packs[1]?.outdated).toBe(true);
    expect(report.packs[0]?.outdated).toBeUndefined();
  });
});
