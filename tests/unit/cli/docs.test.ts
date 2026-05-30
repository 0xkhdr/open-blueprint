import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createDocsCommand } from "../../../src/cli/commands/docs.js";

describe("Docs Command - Documentation Generator", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-docs-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates docs command", () => {
    const cmd = createDocsCommand();
    expect(cmd.name()).toBe("docs");
  });

  it("has --output option", () => {
    const cmd = createDocsCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--output");
  });

  it("help should mention governance documentation", () => {
    const cmd = createDocsCommand();
    const help = cmd.helpInformation().toLowerCase();
    expect(help).toContain("governance");
  });

  it("describes generating from blueprint", () => {
    const cmd = createDocsCommand();
    const help = cmd.helpInformation().toLowerCase();
    expect(help).toContain("blueprint");
  });

  it("help should mention documentation generation", () => {
    const cmd = createDocsCommand();
    const help = cmd.helpInformation().toLowerCase();
    expect(help).toContain("generate");
  });

  it("supports docs subcommand", () => {
    const cmd = createDocsCommand();
    expect(cmd).toBeDefined();
    expect(cmd.name()).toBe("docs");
  });
});
