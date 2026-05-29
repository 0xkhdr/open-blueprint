import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectMultiBackendDrift,
  saveDriftBaseline,
} from "../../../src/validator/multi-backend-drift.js";

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-drift-test-"));
}

describe("multi-backend drift detection", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports missing when backend configured but no skills dir", () => {
    const results = detectMultiBackendDrift(tmpDir, { backends: ["claude"], exclude: [], plugins: [] });
    const claude = results.find((r) => r.backend === "claude");
    expect(claude?.status).toBe("missing");
  });

  it("reports in sync when backend exists and baseline matches", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude", "skills"), { recursive: true });
    saveDriftBaseline(tmpDir, ["claude"]);
    const results = detectMultiBackendDrift(tmpDir, { backends: ["claude"], exclude: [], plugins: [] });
    const claude = results.find((r) => r.backend === "claude");
    expect(claude?.status).toBe("in sync");
  });

  it("reports drifted when backend files changed after baseline", async () => {
    fs.mkdirSync(path.join(tmpDir, ".claude", "skills"), { recursive: true });
    saveDriftBaseline(tmpDir, ["claude"]);

    await new Promise((r) => setTimeout(r, 50));
    fs.writeFileSync(path.join(tmpDir, ".claude", "skills", "test.md"), "changed", "utf-8");

    const results = detectMultiBackendDrift(tmpDir, { backends: ["claude"], exclude: [], plugins: [] });
    const claude = results.find((r) => r.backend === "claude");
    expect(claude?.status).toBe("drifted");
  });

  it("reports orphaned when backend files exist but not configured", () => {
    fs.mkdirSync(path.join(tmpDir, ".windsurf", "workflows", "skills"), { recursive: true });
    const results = detectMultiBackendDrift(tmpDir, { backends: ["claude"], exclude: [], plugins: [] });
    const windsurf = results.find((r) => r.backend === "windsurf");
    expect(windsurf?.status).toBe("orphaned");
  });

  it("reports each backend separately", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude", "skills"), { recursive: true });
    const results = detectMultiBackendDrift(tmpDir, {
      backends: ["claude", "cursor"],
      exclude: [],
      plugins: [],
    });
    const ids = results.map((r) => r.backend);
    expect(ids).toContain("claude");
    expect(ids).toContain("cursor");
  });
});
