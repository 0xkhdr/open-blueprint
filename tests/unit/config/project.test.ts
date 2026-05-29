import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  initProjectConfig,
  loadProjectConfig,
  saveProjectConfig,
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

  it("can initialize and save a valid v2 project configuration", () => {
    const config = initProjectConfig(tmpDir, ["claude"]);
    expect(config.backends).toContain("claude");
    expect(config.primary_backend).toBe("claude");
    expect(config.exclude).toContain("dist/");

    const loaded = loadProjectConfig(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.backends).toContain("claude");
  });

  it("returns null and handles invalid json structure gracefully", () => {
    const configPath = path.join(tmpDir, ".bp.json");
    fs.writeFileSync(configPath, "{ invalid json }", "utf-8");
    const loaded = loadProjectConfig(tmpDir);
    expect(loaded).toBeNull();
  });

  it("v1 backend field is transparently migrated to v2 at read time", () => {
    const configPath = path.join(tmpDir, ".bp.json");
    fs.writeFileSync(configPath, JSON.stringify({ backend: "claude", exclude: [], plugins: [] }), "utf-8");
    const loaded = loadProjectConfig(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.backends).toContain("claude");
    expect(loaded?.primary_backend).toBe("claude");
  });

  it("v2 config with multiple backends reads correctly", () => {
    const configPath = path.join(tmpDir, ".bp.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ backends: ["claude", "cursor"], primary_backend: "claude", exclude: [], plugins: [] }),
      "utf-8"
    );
    const loaded = loadProjectConfig(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.backends).toContain("claude");
    expect(loaded?.backends).toContain("cursor");
    expect(loaded?.primary_backend).toBe("claude");
  });

  it("primary_backend not in backends fails validation", () => {
    const configPath = path.join(tmpDir, ".bp.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ backends: ["cursor"], primary_backend: "claude", exclude: [], plugins: [] }),
      "utf-8"
    );
    const loaded = loadProjectConfig(tmpDir);
    expect(loaded).toBeNull();
  });

  it("can round-trip arbitrary valid project config properties", () => {
    const original = {
      backends: ["cursor"],
      primary_backend: "cursor",
      extends: "@org/custom-bp",
      overrides: {
        rules: {
          severity_defaults: "hard" as const,
        },
      },
      exclude: ["tmp/", "coverage/"],
      plugins: ["plugin-1"],
    };
    saveProjectConfig(tmpDir, original as Parameters<typeof saveProjectConfig>[1]);

    const loaded = loadProjectConfig(tmpDir);
    expect(loaded?.backends).toContain("cursor");
    expect(loaded?.exclude).toContain("tmp/");
  });
});
