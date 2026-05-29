import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getBackend } from "../../../src/backends/registry.js";

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-doctor-backend-test-"));
}

describe("doctor per-backend health checks", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("healthy backend: skills dir exists", () => {
    const config = getBackend("claude");
    const skillsDir = path.join(tmpDir, config.skillsPath);
    fs.mkdirSync(skillsDir, { recursive: true });
    expect(fs.existsSync(skillsDir)).toBe(true);
  });

  it("missing skills dir detected", () => {
    const config = getBackend("claude");
    const skillsDir = path.join(tmpDir, config.skillsPath);
    expect(fs.existsSync(skillsDir)).toBe(false);
  });

  it("codex global path check: $CODEX_HOME unset uses fallback", () => {
    const config = getBackend("codex");
    expect(config.globalHomeEnv).toBe("CODEX_HOME");
    expect(config.fallbackGlobalPath).toBeTruthy();
    expect(config.fallbackGlobalPath).toContain("prompts");
  });

  it("github-copilot backend has IDE-only note", () => {
    const config = getBackend("github-copilot");
    expect(config.note).toContain("IDE");
  });
});
