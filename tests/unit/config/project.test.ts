import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadProjectConfig,
  saveProjectConfig,
  initProjectConfig,
} from "../../../src/config/project.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-project-config-test-"));
}

describe("project config", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null if .bp.json does not exist", () => {
    const config = loadProjectConfig(tmpDir);
    expect(config).toBeNull();
  });

  it("can initialize and save a valid project configuration", () => {
    const config = initProjectConfig(tmpDir, "claude");
    expect(config.backend).toBe("claude");
    expect(config.exclude).toContain("dist/");

    const loaded = loadProjectConfig(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.backend).toBe("claude");
    expect(loaded?.exclude).toContain("vendor/");
  });

  it("returns null and handles invalid json structure gracefully", () => {
    const configPath = path.join(tmpDir, ".bp.json");
    fs.writeFileSync(configPath, "{ invalid json }", "utf-8");
    const loaded = loadProjectConfig(tmpDir);
    expect(loaded).toBeNull();
  });

  it("can round-trip arbitrary valid project config properties", () => {
    const original = {
      backend: "cursor",
      extends: "@org/custom-bp",
      overrides: {
        rules: {
          severity_defaults: "hard" as const,
        },
      },
      exclude: ["tmp/", "coverage/"],
      plugins: ["plugin-1"],
    };
    saveProjectConfig(tmpDir, original);

    const loaded = loadProjectConfig(tmpDir);
    expect(loaded).toEqual({
      backend: "cursor",
      extends: "@org/custom-bp",
      overrides: {
        rules: {
          severity_defaults: "hard",
        },
      },
      exclude: ["tmp/", "coverage/"],
      plugins: ["plugin-1"],
    });
  });
});
