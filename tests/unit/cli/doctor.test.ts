import { describe, expect, it } from "vitest";
import { createDoctorCommand } from "../../../src/cli/commands/doctor.js";
import { createRuleCommand } from "../../../src/cli/commands/rule.js";

describe("Doctor & Rule CLI Commands", () => {
  it("creates doctor command successfully", () => {
    const cmd = createDoctorCommand();
    expect(cmd.name()).toBe("doctor");
  });

  it("creates rule command successfully", () => {
    const cmd = createRuleCommand();
    expect(cmd.name()).toBe("rule");
    
    // Check subcommands
    const subs = cmd.commands.map((c) => c.name());
    expect(subs).toContain("test");
    expect(subs).toContain("lint");
    expect(subs).toContain("graph");
  });
});
