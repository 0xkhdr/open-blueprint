import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createDevCommand } from "../../../src/cli/commands/dev.js";

describe("Dev Command - Live Reload", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-dev-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates dev command", () => {
    const cmd = createDevCommand();
    expect(cmd.name()).toBe("dev");
  });

  it("has --watch option", () => {
    const cmd = createDevCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--watch");
  });

  it("has --level option for validation level", () => {
    const cmd = createDevCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--level");
  });

  it("help should mention live reload", () => {
    const cmd = createDevCommand();
    const help = cmd.helpInformation().toLowerCase();
    expect(help).toContain("live");
  });

  it("help should mention validation", () => {
    const cmd = createDevCommand();
    const help = cmd.helpInformation().toLowerCase();
    expect(help).toContain("validation");
  });

  it("help should mention dev server", () => {
    const cmd = createDevCommand();
    const help = cmd.helpInformation().toLowerCase();
    expect(help).toContain("dev");
  });
});
