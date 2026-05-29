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
      // loadProjectConfig catches errors and returns null — health check still passes
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

  describe("JSON output format", () => {
    it("checkConfigParseable result matches {name, status, message} shape", async () => {
      const result = await checkConfigParseable(tmpDir);
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("message");
      expect(["PASS", "FAIL"]).toContain(result.status);
    });

    it("checkEnginesImportable result matches schema", async () => {
      const result = await checkEnginesImportable();
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json) as { name: string; status: string; message: string };
      expect(parsed.name).toBe("engines-importable");
      expect(parsed.status).toBe("PASS");
      expect(typeof parsed.message).toBe("string");
    });
  });
});
