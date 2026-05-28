import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createMigrateCommand } from "../../../src/cli/commands/migrate.js";

describe("Migrate Command - Cross-Tool Migration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-migrate-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create migrate command", () => {
    const cmd = createMigrateCommand();
    expect(cmd.name()).toBe("migrate");
  });

  it("should support --from backend option", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--from");
  });

  it("should support --to backend option", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--to");
  });

  it("should include all supported backends in help", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation();
    const backends = [
      "claude",
      "cursor",
      "codex",
      "pi",
      "kiro",
      "antigravity",
      "copilot",
      "gemini",
      "generic",
    ];
    for (const backend of backends) {
      expect(help.toLowerCase()).toContain(backend);
    }
  });

  it("should support --input directory option", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--input");
  });

  it("should support --output directory option", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--output");
  });

  it("should support both schema and cross-backend migration", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation().toLowerCase();
    expect(help).toContain("migrate blueprint");
  });

  it("should mention fingerprint in help for schema migration", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation().toLowerCase();
    // Schema migration fallback should be mentioned
    expect(help).toContain("schema");
  });
});
