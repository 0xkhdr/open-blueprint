import { describe, expect, it } from "vitest";
import { sanitizeTemplateVars } from "../../../src/templater/index.js";

describe("sanitizeTemplateVars", () => {
  it("passes through clean values unchanged", () => {
    const vars = { name: "my-project", lang: "typescript" };
    expect(sanitizeTemplateVars(vars)).toEqual(vars);
  });

  it("strips semicolons from values", () => {
    const result = sanitizeTemplateVars({ cmd: "echo hello; rm -rf /" });
    expect(result.cmd).not.toContain(";");
  });

  it("strips pipe characters", () => {
    const result = sanitizeTemplateVars({ val: "a | b" });
    expect(result.val).not.toContain("|");
  });

  it("strips backtick command substitution", () => {
    const result = sanitizeTemplateVars({ val: "`whoami`" });
    expect(result.val).not.toContain("`");
  });

  it("strips dollar-sign variable expansion", () => {
    const result = sanitizeTemplateVars({ val: "$(id)" });
    expect(result.val).not.toContain("$");
  });

  it("strips parentheses", () => {
    const result = sanitizeTemplateVars({ val: "foo(bar)" });
    expect(result.val).not.toContain("(");
    expect(result.val).not.toContain(")");
  });

  it("strips curly braces", () => {
    const result = sanitizeTemplateVars({ val: "${VAR}" });
    expect(result.val).not.toContain("{");
    expect(result.val).not.toContain("}");
  });

  it("strips angle brackets", () => {
    const result = sanitizeTemplateVars({ val: "<script>alert(1)</script>" });
    expect(result.val).not.toContain("<");
    expect(result.val).not.toContain(">");
  });

  it("strips backslash", () => {
    const result = sanitizeTemplateVars({ val: "foo\\bar" });
    expect(result.val).not.toContain("\\");
  });

  it("preserves alphanumeric content after stripping", () => {
    const result = sanitizeTemplateVars({ val: "hello; world" });
    expect(result.val).toContain("hello");
    expect(result.val).toContain("world");
  });

  it("handles multiple keys independently", () => {
    const result = sanitizeTemplateVars({ safe: "clean", dirty: "a;b|c" });
    expect(result.safe).toBe("clean");
    expect(result.dirty).not.toContain(";");
    expect(result.dirty).not.toContain("|");
  });

  it("returns new object (does not mutate input)", () => {
    const input = { val: "test; injection" };
    const result = sanitizeTemplateVars(input);
    expect(input.val).toBe("test; injection");
    expect(result.val).not.toContain(";");
  });

  it("handles empty string values", () => {
    expect(sanitizeTemplateVars({ val: "" })).toEqual({ val: "" });
  });

  it("handles empty object", () => {
    expect(sanitizeTemplateVars({})).toEqual({});
  });
});
