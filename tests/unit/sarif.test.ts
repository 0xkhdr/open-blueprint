import { describe, it, expect } from "vitest";
import { toSarif } from "../../src/cli/formatters/sarif.js";
import type { ValidationError } from "../../src/validator/structural.js";

describe("toSarif", () => {
  it("produces valid SARIF 2.1.0 structure", () => {
    const errors: ValidationError[] = [
      {
        file: "src/example.ts",
        line: 10,
        type: "MISSING_REQUIRED_FIELD",
        severity: "error",
        message: "Missing required field: scope",
        resolution: "Add scope field to frontmatter",
      },
      {
        file: "src/other.ts",
        type: "INVALID_SEVERITY",
        severity: "warning",
        message: "Severity must be hard, soft, or info",
        resolution: "Change severity to a valid value",
      },
    ];

    const sarif = toSarif(errors, "1.0.0");

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toContain("sarif-schema-2.1.0");
    expect(sarif.runs).toHaveLength(1);

    const run = sarif.runs[0]!;
    expect(run.tool.driver.name).toBe("bp");
    expect(run.tool.driver.version).toBe("1.0.0");
    expect(run.tool.driver.rules).toHaveLength(2);

    expect(run.results).toHaveLength(2);

    const [first, second] = run.results as typeof run.results;
    expect(first!.ruleId).toBe("MISSING_REQUIRED_FIELD");
    expect(first!.level).toBe("error");
    expect(first!.message.text).toContain("Missing required field");
    expect(first!.locations[0]!.physicalLocation.region?.startLine).toBe(10);

    expect(second!.ruleId).toBe("INVALID_SEVERITY");
    expect(second!.level).toBe("warning");
    expect(second!.locations[0]!.physicalLocation.region).toBeUndefined();
  });

  it("handles empty error array", () => {
    const sarif = toSarif([]);
    expect(sarif.runs[0]!.results).toHaveLength(0);
    expect(sarif.runs[0]!.tool.driver.rules).toHaveLength(0);
  });
});
