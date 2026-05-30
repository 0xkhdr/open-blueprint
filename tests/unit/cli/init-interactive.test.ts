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

  it("creates init command", () => {
    const cmd = createInitCommand();
    expect(cmd.name()).toBe("init");
  });

  it("has --interactive flag in help", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--interactive");
  });

  it("supports --tools flag for multi-backend init", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--tools");
  });

  it("supports --tool option", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--tool");
  });

  it("supports --template option", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--template");
  });

  it("supports --force option", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--force");
  });

  it("supports --dry-run option", () => {
    const cmd = createInitCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--dry-run");
  });
});
