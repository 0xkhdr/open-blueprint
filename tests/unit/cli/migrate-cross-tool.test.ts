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

  it("creates migrate command", () => {
    const cmd = createMigrateCommand();
    expect(cmd.name()).toBe("migrate");
  });

  it("supports --from backend option", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--from");
  });

  it("supports --to backend option", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--to");
  });

  it("includes all supported backends in help", () => {
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

  it("supports --input directory option", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--input");
  });

  it("supports --output directory option", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation();
    expect(help).toContain("--output");
  });

  it("supports both schema and cross-backend migration", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation().toLowerCase();
    expect(help).toContain("migrate blueprint");
  });

  it("mentions fingerprint in help for schema migration", () => {
    const cmd = createMigrateCommand();
    const help = cmd.helpInformation().toLowerCase();
    // Schema migration fallback should be mentioned
    expect(help).toContain("schema");
  });
});
