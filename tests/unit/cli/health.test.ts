import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkConfigParseable,
  checkEnginesImportable,
  checkNoConflictingConfigs,
} from "../../../src/cli/commands/health.js";

describe("health checks", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-health-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("checkConfigParseable", () => {
    it("returns PASS when no config file present (config is optional)", async () => {
      const result = await checkConfigParseable(tmpDir);
      expect(result.name).toBe("config-parse");
      expect(result.status).toBe("PASS");
    });

    it("returns PASS when valid .bp.json exists", async () => {
      fs.writeFileSync(path.join(tmpDir, ".bp.json"), JSON.stringify({ backend: "claude" }));
      const result = await checkConfigParseable(tmpDir);
      expect(result.status).toBe("PASS");
    });

    it("returns PASS when .bp.json is malformed JSON (loadProjectConfig swallows parse errors)", async () => {
      fs.writeFileSync(path.join(tmpDir, ".bp.json"), "{ invalid json }");
      const result = await checkConfigParseable(tmpDir);
      expect(result.status).toBe("PASS");
    });
  });

  describe("checkEnginesImportable", () => {
    it("returns PASS when all engines importable", async () => {
      const result = await checkEnginesImportable();
      expect(result.name).toBe("engines-importable");
      expect(result.status).toBe("PASS");
    });
  });

  describe("checkNoConflictingConfigs", () => {
    it("returns PASS when no project config exists", async () => {
      const result = await checkNoConflictingConfigs(tmpDir);
      expect(result.name).toBe("no-config-conflict");
      expect(result.status).toBe("PASS");
    });

    it("returns PASS when project config has no default_backend conflict", async () => {
      fs.writeFileSync(path.join(tmpDir, ".bp.json"), JSON.stringify({ backend: "claude" }));
      const result = await checkNoConflictingConfigs(tmpDir);
      expect(result.status).toBe("PASS");
    });
  });
});

describe("bp health output format snapshots", () => {
  it("checkConfigParseable result shape matches snapshot", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-health-snap-"));
    try {
      const result = await checkConfigParseable(tmpDir);
      expect({
        name: result.name,
        status: result.status,
        hasMessage: typeof result.message === "string",
      }).toMatchSnapshot();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("checkEnginesImportable result shape matches snapshot", async () => {
    const result = await checkEnginesImportable();
    expect({
      name: result.name,
      status: result.status,
      hasMessage: typeof result.message === "string",
    }).toMatchSnapshot();
  });

  it("checkNoConflictingConfigs result shape matches snapshot", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-health-snap-"));
    try {
      const result = await checkNoConflictingConfigs(tmpDir);
      expect({
        name: result.name,
        status: result.status,
        hasMessage: typeof result.message === "string",
      }).toMatchSnapshot();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("JSON output schema: all checks have name, status, message", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-health-snap-"));
    try {
      const [cfg, engines, noConflict] = await Promise.all([
        checkConfigParseable(tmpDir),
        checkEnginesImportable(),
        checkNoConflictingConfigs(tmpDir),
      ]);
      for (const check of [cfg, engines, noConflict]) {
        expect(typeof check.name).toBe("string");
        expect(["PASS", "FAIL"]).toContain(check.status);
        expect(typeof check.message).toBe("string");
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
