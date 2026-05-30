import { describe, expect, it } from "vitest";
import { TemplateVarsValidationError } from "../../../src/templater/errors.js";
import { sanitizeTemplateVars } from "../../../src/templater/index.js";

describe("secure-vars-validation", () => {
  it("valid flat vars pass through", () => {
    const result = sanitizeTemplateVars({ name: "my-project", version: "1.0.0" });
    expect(result.name).toBe("my-project");
    expect(result.version).toBe("1.0.0");
  });

  it("oversized string value is rejected", () => {
    const bigStr = "a".repeat(10_001);
    expect(() => sanitizeTemplateVars({ key: bigStr })).toThrow(TemplateVarsValidationError);
  });

  it("string at max length passes", () => {
    const maxStr = "a".repeat(10_000);
    expect(() => sanitizeTemplateVars({ key: maxStr })).not.toThrow();
  });

  it("reserved Handlebars helper key 'each' is rejected", () => {
    expect(() => sanitizeTemplateVars({ each: "val" })).toThrow(TemplateVarsValidationError);
  });

  it("all reserved Handlebars helper keys are rejected", () => {
    for (const key of ["if", "unless", "each", "with", "lookup", "log"]) {
      expect(() => sanitizeTemplateVars({ [key]: "v" })).toThrow(TemplateVarsValidationError);
    }
  });

  it("deeply nested object beyond depth 5 is rejected", () => {
    const deep = { a: { b: { c: { d: { e: { f: "too deep" } } } } } };
    expect(() => sanitizeTemplateVars({ nested: deep })).toThrow(TemplateVarsValidationError);
  });

  it("object nested exactly at depth 5 passes", () => {
    const ok = { a: { b: { c: { d: "ok" } } } };
    expect(() => sanitizeTemplateVars({ nested: ok })).not.toThrow();
  });

  it("object with custom prototype is sanitized — no prototype methods leak", () => {
    const proto = { evil: () => "pwned" };
    const obj = Object.create(proto) as Record<string, unknown>;
    obj.name = "safe";
    const result = sanitizeTemplateVars(obj);
    expect(result.name).toBe("safe");
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it("TemplateVarsValidationError exposes failing fields", () => {
    try {
      sanitizeTemplateVars({ if: "bad" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TemplateVarsValidationError);
      expect((err as TemplateVarsValidationError).fields.length).toBeGreaterThan(0);
    }
  });

  it("empty vars pass validation", () => {
    expect(() => sanitizeTemplateVars({})).not.toThrow();
  });
});
