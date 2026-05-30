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

    const subs = cmd.commands.map((c) => c.name());
    expect(subs).toContain("test");
    expect(subs).toContain("lint");
    expect(subs).toContain("graph");
  });
});

describe("bp doctor output format snapshots", () => {
  it("doctor command name matches snapshot", () => {
    const cmd = createDoctorCommand();
    expect(cmd.name()).toMatchSnapshot();
  });

  it("doctor command description matches snapshot", () => {
    const cmd = createDoctorCommand();
    expect(cmd.description()).toMatchSnapshot();
  });

  it("doctor command options list matches snapshot", () => {
    const cmd = createDoctorCommand();
    const opts = cmd.options.map((o) => ({
      flags: o.flags,
      description: o.description,
    }));
    expect(opts).toMatchSnapshot();
  });

  it("doctor command help text contains expected sections", () => {
    const cmd = createDoctorCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--tool");
    expect(help).toContain("--json");
    expect(help).toContain("--verbose");
  });
});
