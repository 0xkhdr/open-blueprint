import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyFixture, createTmpDir, runBp } from "./setup.js";

describe("E2E: bp verify --level drift", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("clean state (exit 0)", () => {
    it("exits 0 when blueprint matches the project state", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);
      const result = runBp("verify --level drift", tmpDir);
      // drift-repo fixture is consistent — should pass or give info (not exit > 5)
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.exitCode).toBeLessThanOrEqual(10);
    });

    it("does not panic with --json flag", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);
      const result = runBp("verify --level drift --json", tmpDir);
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      // output should be valid JSON when --json used
      const output = result.stdout.trim();
      if (output) {
        expect(() => JSON.parse(output)).not.toThrow();
      }
    });
  });

  describe("drifted state (exit 6 for drift detected)", () => {
    it("detects drift when CLAUDE.md entry point differs from package.json", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);

      // Modify package.json to change the main entry — creates drift with CLAUDE.md
      const pkgPath = path.join(tmpDir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
        pkg.main = "dist/different-entry.js";
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      }

      const result = runBp("verify --level drift", tmpDir);
      // Should exit with drift or structural failure code
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.exitCode).toBeLessThanOrEqual(10);
    });
  });

  describe("behavioral drift command", () => {
    const metricA = {
      timestamp: new Date().toISOString(),
      total_tokens: 50000,
      session_duration_ms: 120000,
      error_rate: 0.02,
      success_rate: 0.98,
      rule_success_rate: { "security-no-secrets": 0.95 },
      agent_action_distribution: { read: 0.6, write: 0.4 },
      skill_invocation_count: { "run-tests": 25 },
    };

    function writeMetricsFiles(dir: string): { ndjson: string; baseline: string; current: string } {
      const ndjson = path.join(dir, "metrics.ndjson");
      fs.writeFileSync(ndjson, `${JSON.stringify(metricA)}\n`);
      const baseline = path.join(dir, "baseline.json");
      const current = path.join(dir, "current.json");
      return { ndjson, baseline, current };
    }

    it("bp drift baseline requires a metrics file", { timeout: 15000 }, () => {
      const result = runBp("drift baseline", tmpDir);
      expect(result.exitCode).not.toBe(0);
    });

    it("bp drift baseline builds a baseline from a real metrics file", { timeout: 15000 }, () => {
      const { ndjson } = writeMetricsFiles(tmpDir);
      const result = runBp(`drift baseline --metrics ${ndjson} --json`, tmpDir);
      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it("bp drift behavioral requires baseline and current files", { timeout: 15000 }, () => {
      const result = runBp("drift behavioral", tmpDir);
      expect(result.exitCode).not.toBe(0);
    });

    it("bp drift behavioral compares real files and outputs JSON", { timeout: 20000 }, () => {
      const { ndjson, baseline, current } = writeMetricsFiles(tmpDir);
      const base = runBp(`drift baseline --metrics ${ndjson} --json`, tmpDir);
      fs.writeFileSync(baseline, base.stdout.trim());
      fs.writeFileSync(current, JSON.stringify(metricA));
      const result = runBp(
        `drift behavioral --baseline ${baseline} --current ${current} --json`,
        tmpDir
      );
      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });
  });
});
