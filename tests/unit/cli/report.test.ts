import { describe, expect, it } from "vitest";
import { exitCodeForReport, filterReportByFramework } from "../../../src/cli/commands/report.js";
import { buildGovernanceReport } from "../../../src/report/build.js";
import { GovernanceReportSchema } from "../../../src/report/model.js";
import type { RuleOutcome } from "../../../src/validator/enforcement.js";
import { EXIT_CODES } from "../../../src/validator/index.js";

function outcome(partial: Partial<RuleOutcome> & { id: string }): RuleOutcome {
  return {
    file: `/repo/.claude/rules/${partial.id}.md`,
    severity: "hard",
    enforcement: "auto",
    status: "pass",
    ...partial,
  };
}

const project = { name: "demo", root: "/repo", backend: "claude" };

describe("exitCodeForReport (--fail-on thresholds)", () => {
  const clean = buildGovernanceReport({ project, outcomes: [outcome({ id: "ok" })] });
  const softOnly = buildGovernanceReport({
    project,
    outcomes: [outcome({ id: "soft", severity: "soft", status: "fail" })],
  });
  const hard = buildGovernanceReport({
    project,
    outcomes: [outcome({ id: "hard", status: "fail" })],
  });
  const invalid = buildGovernanceReport({
    project,
    outcomes: [outcome({ id: "broken", status: "invalid" })],
  });

  it("default hard threshold: hard/invalid fail, soft passes", () => {
    expect(exitCodeForReport(clean, "hard")).toBe(EXIT_CODES.SUCCESS);
    expect(exitCodeForReport(softOnly, "hard")).toBe(EXIT_CODES.SUCCESS);
    expect(exitCodeForReport(hard, "hard")).toBe(EXIT_CODES.STRUCTURAL_FAILURE);
    expect(exitCodeForReport(invalid, "hard")).toBe(EXIT_CODES.STRUCTURAL_FAILURE);
  });

  it("soft threshold also fails on soft violations", () => {
    expect(exitCodeForReport(clean, "soft")).toBe(EXIT_CODES.SUCCESS);
    expect(exitCodeForReport(softOnly, "soft")).toBe(EXIT_CODES.STRUCTURAL_FAILURE);
    expect(exitCodeForReport(hard, "soft")).toBe(EXIT_CODES.STRUCTURAL_FAILURE);
  });

  it("none never fails", () => {
    expect(exitCodeForReport(hard, "none")).toBe(EXIT_CODES.SUCCESS);
    expect(exitCodeForReport(softOnly, "none")).toBe(EXIT_CODES.SUCCESS);
  });
});

describe("filterReportByFramework", () => {
  const report = buildGovernanceReport({
    project,
    outcomes: [
      outcome({ id: "gdpr-rule", status: "fail", pack: { id: "gdpr-pack", version: "1.0.0" } }),
      outcome({ id: "soc2-rule", pack: { id: "soc2-pack", version: "2.0.0" } }),
      outcome({ id: "local-rule" }),
    ],
    packs: [
      {
        id: "gdpr-pack",
        version: "1.0.0",
        source: "project",
        kind: "rules",
        framework: "gdpr",
        integrity: "ok",
        outdated: false,
        trust: "unsigned-accepted",
      },
      {
        id: "soc2-pack",
        version: "2.0.0",
        source: "project",
        kind: "rules",
        framework: "soc2",
        integrity: "ok",
        outdated: false,
      },
    ],
  });

  it("keeps only the framework's packs and their rules, recomputing the summary", () => {
    const filtered = filterReportByFramework(report, "gdpr");
    expect(GovernanceReportSchema.parse(filtered)).toEqual(filtered);
    expect(filtered.packs.map((p) => p.id)).toEqual(["gdpr-pack"]);
    expect(filtered.rules.map((r) => r.id)).toEqual(["gdpr-rule"]);
    expect(filtered.summary).toMatchObject({
      rules_total: 1,
      violations_hard: 1,
      packs_installed: 1,
      packs_unsigned: 1,
    });
  });

  it("yields an empty report for an unknown framework", () => {
    const filtered = filterReportByFramework(report, "hipaa");
    expect(filtered.rules).toEqual([]);
    expect(filtered.packs).toEqual([]);
    expect(filtered.summary.rules_total).toBe(0);
    expect(filtered.summary.packs_unsigned).toBeUndefined();
  });
});
