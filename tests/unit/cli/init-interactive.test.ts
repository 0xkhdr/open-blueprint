import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createInitCommand } from "../../../src/cli/commands/init.js";

describe("Init Command - Interactive Mode", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-init-interactive-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create init command", () => {
    const cmd = createInitCommand();
    expect(cmd.name()).toBe("init");
  });

  it("should have --interactive flag in help", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--interactive");
  });

  it("should support all 10 backends in help text", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    const expectedBackends = [
      "claude",
      "cursor",
      "codex",
      "pi",
      "kiro",
      "antigravity",
      "copilot",
      "gemini",
      "opendev",
      "generic",
    ];
    for (const backend of expectedBackends) {
      expect(help.toLowerCase()).toContain(backend);
    }
  });

  it("should support --tool option", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--tool");
  });

  it("should support --template option", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--template");
  });

  it("should support --force option", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--force");
  });

  it("should support --dry-run option", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--dry-run");
  });
});
