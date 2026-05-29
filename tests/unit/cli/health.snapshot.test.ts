import { describe, expect, it } from "vitest";
import {
  checkConfigParseable,
  checkEnginesImportable,
  checkNoConflictingConfigs,
} from "../../../src/cli/commands/health.js";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

describe("bp health output format snapshots", () => {
  it("checkConfigParseable result shape matches snapshot", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-health-snap-"));
    try {
      const result = await checkConfigParseable(tmpDir);
      // Strip dynamic message content, snapshot the structure
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
