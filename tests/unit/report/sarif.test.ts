import * as fs from "node:fs";
import * as path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { buildGovernanceReport } from "../../../src/report/build.js";
import { reportToSarif, toSarif } from "../../../src/report/sarif.js";
import type { ValidationError } from "../../../src/validator/structural.js";

const SCHEMA_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../fixtures/sarif-schema-2.1.0.json"
);

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateSarif = ajv.compile(JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8")));

function expectSchemaValid(log: unknown): void {
  const valid = validateSarif(log);
  if (!valid) {
    throw new Error(`SARIF schema violations: ${JSON.stringify(validateSarif.errors, null, 2)}`);
  }
  expect(valid).toBe(true);
}

const sampleReport = buildGovernanceReport({
  project: { name: "demo", root: "/repo", backend: "claude" },
  outcomes: [
    {
      id: "no-console",
      file: "/repo/.claude/rules/pack-acme-no-console.md",
      severity: "hard",
      enforcement: "auto",
      status: "fail",
      detail: "pattern /console\\.log\\(/ found in 1 file(s)",
      evidence: [{ file: "src/index.ts", line: 7 }],
      pack: { id: "acme", version: "1.0.0" },
    },
    {
      id: "readme-required",
      file: "/repo/.claude/rules/readme.md",
      severity: "soft",
      enforcement: "auto",
      status: "pass",
    },
    {
      id: "broken-check",
      file: "/repo/.claude/rules/broken.md",
      severity: "hard",
      enforcement: "auto",
      status: "invalid",
      detail: "type: unknown check type",
    },
    {
      id: "manual-control",
      file: "/repo/.claude/rules/manual.md",
      severity: "soft",
      enforcement: "manual",
      status: "manual",
    },
  ],
  packs: [
    {
      id: "acme",
      version: "1.0.0",
      source: "project",
      kind: "rules",
      framework: "custom",
      integrity: "ok",
      outdated: false,
    },
  ],
  generatedAt: "2026-06-11T00:00:00.000Z",
});

describe("reportToSarif", () => {
  const log = reportToSarif(sampleReport, "1.0.0");

  it("passes SARIF 2.1.0 schema validation", () => {
    expectSchemaValid(log);
  });

  it("emits one rules[] entry per bp rule with severity/pack/framework properties", () => {
    const rules = log.runs[0]?.tool.driver.rules ?? [];
    expect(rules.map((r) => r.id).sort()).toEqual([
      "broken-check",
      "manual-control",
      "no-console",
      "readme-required",
    ]);
    const noConsole = rules.find((r) => r.id === "no-console");
    expect(noConsole?.properties).toMatchObject({
      severity: "hard",
      pack: "acme",
      packVersion: "1.0.0",
      framework: "custom",
    });
  });

  it("emits results only for violations, located at the violating evidence", () => {
    const results = log.runs[0]?.results ?? [];
    expect(results.map((r) => r.ruleId).sort()).toEqual(["broken-check", "no-console"]);

    const violation = results.find((r) => r.ruleId === "no-console");
    expect(violation?.level).toBe("error");
    expect(violation?.locations[0]?.physicalLocation).toEqual({
      artifactLocation: { uri: "src/index.ts" },
      region: { startLine: 7 },
    });

    // invalid check falls back to the rule file location
    const invalid = results.find((r) => r.ruleId === "broken-check");
    expect(invalid?.level).toBe("error");
    expect(invalid?.locations[0]?.physicalLocation.artifactLocation.uri).toBe(
      ".claude/rules/broken.md"
    );
  });

  it("soft violations map to warning level", () => {
    const soft = buildGovernanceReport({
      project: { name: "demo", root: "/repo", backend: "claude" },
      outcomes: [
        {
          id: "soft-rule",
          file: "/repo/.claude/rules/soft.md",
          severity: "soft",
          enforcement: "auto",
          status: "fail",
        },
      ],
    });
    const softLog = reportToSarif(soft);
    expect(softLog.runs[0]?.results[0]?.level).toBe("warning");
    expectSchemaValid(softLog);
  });
});

describe("toSarif (shared with bp verify)", () => {
  it("still produces schema-valid output from ValidationErrors", () => {
    const errors: ValidationError[] = [
      {
        file: "src/example.ts",
        line: 10,
        type: "RULE_VIOLATION",
        severity: "error",
        message: "Rule 'x' violated",
        resolution: "Fix it",
      },
      {
        file: ".bp/packs.lock.json",
        type: "PACK_DRIFTED",
        severity: "warning",
        message: "Pack 'acme' drifted",
        resolution: "Re-install",
      },
    ];
    expectSchemaValid(toSarif(errors));
  });
});
