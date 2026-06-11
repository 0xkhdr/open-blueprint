import { describe, expect, it } from "vitest";
import { type BpPlugin, definePlugin } from "../../../src/plugin/index.js";

function validPlugin(overrides: Partial<BpPlugin> = {}): BpPlugin {
  return {
    name: "acme-checks",
    version: "1.0.0",
    validators: [{ id: "check-one", level: "semantic", check: () => {} }],
    ...overrides,
  };
}

describe("definePlugin", () => {
  it("returns the original plugin object on success", () => {
    const plugin = validPlugin();
    expect(definePlugin(plugin)).toBe(plugin);
  });

  it("accepts all four validator levels", () => {
    for (const level of ["structural", "semantic", "logical", "enforcement"] as const) {
      expect(() =>
        definePlugin(validPlugin({ validators: [{ id: "v", level, check: () => {} }] }))
      ).not.toThrow();
    }
  });

  it("rejects an invalid name", () => {
    expect(() => definePlugin(validPlugin({ name: "bad name!" }))).toThrow(
      /Invalid plugin definition.*name/
    );
  });

  it("rejects a non-semver version", () => {
    expect(() => definePlugin(validPlugin({ version: "1.0" }))).toThrow(/semver/);
  });

  it("rejects an invalid validator level", () => {
    const plugin = validPlugin();
    (plugin.validators[0] as { level: string }).level = "cosmic";
    expect(() => definePlugin(plugin)).toThrow(/Invalid plugin definition/);
  });

  it("rejects an empty validators array", () => {
    expect(() => definePlugin(validPlugin({ validators: [] }))).toThrow(/at least one validator/);
  });

  it("rejects duplicate validator ids", () => {
    expect(() =>
      definePlugin(
        validPlugin({
          validators: [
            { id: "dup", level: "semantic", check: () => {} },
            { id: "dup", level: "logical", check: () => {} },
          ],
        })
      )
    ).toThrow(/duplicate validator id "dup"/);
  });

  it("rejects a non-function check", () => {
    const plugin = validPlugin();
    (plugin.validators[0] as { check: unknown }).check = "not-a-function";
    expect(() => definePlugin(plugin)).toThrow(/check must be a function/);
  });
});
