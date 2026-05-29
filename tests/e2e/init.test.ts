import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyFixture, createTmpDir, runBp } from "./setup.js";

describe("E2E: bp init", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("golden path: bp init claude against node-express fixture exits 0", { timeout: 30000 }, () => {
    copyFixture("node-express", tmpDir);
    const result = runBp("init claude", tmpDir);
    expect(result.exitCode).toBe(0);
  });

  it("creates CLAUDE.md in project root", { timeout: 30000 }, () => {
    copyFixture("node-express", tmpDir);
    runBp("init claude", tmpDir);
    const claudeMd = path.join(tmpDir, "CLAUDE.md");
    expect(fs.existsSync(claudeMd)).toBe(true);
  });

  it("CLAUDE.md contains project name", { timeout: 30000 }, () => {
    copyFixture("node-express", tmpDir);
    runBp("init claude", tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("creates .claude/ directory structure", { timeout: 30000 }, () => {
    copyFixture("node-express", tmpDir);
    runBp("init claude", tmpDir);
    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(true);
  });

  it("init with unknown backend exits with non-zero code", { timeout: 30000 }, () => {
    copyFixture("node-express", tmpDir);
    const result = runBp("init nonexistent-backend-xyz", tmpDir);
    expect(result.exitCode).not.toBe(0);
  });

  it("init idempotent: running twice produces same CLAUDE.md", { timeout: 60000 }, () => {
    copyFixture("node-express", tmpDir);
    runBp("init claude", tmpDir);
    const first = fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    runBp("init claude --force", tmpDir);
    const second = fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(first).toBe(second);
  });
});
