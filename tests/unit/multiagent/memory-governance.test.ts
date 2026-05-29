import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupExpiredMemory,
  enforceMemoryGovernance,
  type MemoryGovernanceConfig,
} from "../../../src/multiagent/memory.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-memory-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(name: string, content = "data", mtime?: Date): string {
  const p = path.join(tmpDir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
  if (mtime) fs.utimesSync(p, mtime, mtime);
  return p;
}

const defaultConfig: MemoryGovernanceConfig = {
  retention_policy: "week",
  max_size_mb: 100,
  encryption_at_rest: false,
  access_control: [],
};

describe("enforceMemoryGovernance", () => {
  it("returns compliant for non-existent directory", () => {
    const result = enforceMemoryGovernance("/nonexistent/path/xyz", defaultConfig);
    expect(result.compliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("returns compliant for empty directory", () => {
    const result = enforceMemoryGovernance(tmpDir, defaultConfig);
    expect(result.compliant).toBe(true);
  });

  it("returns correct file count", () => {
    writeFile("a.json");
    writeFile("b.json");
    const result = enforceMemoryGovernance(tmpDir, defaultConfig);
    expect(result.stats.file_count).toBe(2);
  });

  it("returns correct size_bytes", () => {
    writeFile("data.txt", "hello");
    const result = enforceMemoryGovernance(tmpDir, defaultConfig);
    expect(result.stats.size_bytes).toBeGreaterThan(0);
  });

  it("flags violation when directory exceeds max_size_mb", () => {
    // Write a file that's ~1 byte, set max to 0.000001 MB
    writeFile("big.bin", "x".repeat(1024));
    const config = { ...defaultConfig, max_size_mb: 0.0001 };
    const result = enforceMemoryGovernance(tmpDir, config);
    expect(result.compliant).toBe(false);
    expect(result.violations.some((v) => v.includes("exceeds max size"))).toBe(true);
  });

  it("does not flag size violation within limit", () => {
    writeFile("small.txt", "x");
    const result = enforceMemoryGovernance(tmpDir, { ...defaultConfig, max_size_mb: 100 });
    expect(result.violations.some((v) => v.includes("exceeds max size"))).toBe(false);
  });

  it("flags encryption violation when required and missing", () => {
    writeFile("data.json", "{}");
    const config = { ...defaultConfig, encryption_at_rest: true };
    const result = enforceMemoryGovernance(tmpDir, config);
    expect(result.violations.some((v) => v.includes("encrypted"))).toBe(true);
  });

  it("does not flag encryption violation when not required", () => {
    writeFile("data.json", "{}");
    const result = enforceMemoryGovernance(tmpDir, { ...defaultConfig, encryption_at_rest: false });
    expect(result.violations.some((v) => v.includes("encrypted"))).toBe(false);
  });

  it("flags retention violation for old files with session policy", () => {
    const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    writeFile("old.json", "{}", oldDate);
    const config = { ...defaultConfig, retention_policy: "session" as const };
    const result = enforceMemoryGovernance(tmpDir, config);
    expect(result.violations.some((v) => v.includes("retention policy"))).toBe(true);
  });

  it("does not flag recent files for session policy", () => {
    writeFile("new.json", "{}");
    const config = { ...defaultConfig, retention_policy: "session" as const };
    const result = enforceMemoryGovernance(tmpDir, config);
    expect(result.violations.some((v) => v.includes("retention policy"))).toBe(false);
  });

  it("never flags retention for persistent policy", () => {
    const veryOld = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    writeFile("ancient.json", "{}", veryOld);
    const config = { ...defaultConfig, retention_policy: "persistent" as const };
    const result = enforceMemoryGovernance(tmpDir, config);
    expect(result.violations.some((v) => v.includes("retention policy"))).toBe(false);
  });

  it("counts files in subdirectories", () => {
    writeFile("sub/a.json");
    writeFile("sub/b.json");
    const result = enforceMemoryGovernance(tmpDir, defaultConfig);
    expect(result.stats.file_count).toBe(2);
  });
});

describe("cleanupExpiredMemory", () => {
  it("returns empty array for non-existent directory", () => {
    const removed = cleanupExpiredMemory("/nonexistent", "week");
    expect(removed).toEqual([]);
  });

  it("does not remove fresh files", () => {
    writeFile("fresh.json");
    const removed = cleanupExpiredMemory(tmpDir, "session");
    expect(removed).toHaveLength(0);
  });

  it("removes expired files for session policy", () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    writeFile("old.json", "{}", old);
    const removed = cleanupExpiredMemory(tmpDir, "session");
    expect(removed).toHaveLength(1);
    expect(removed[0]).toContain("old.json");
  });

  it("does not remove files for persistent policy", () => {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    writeFile("ancient.json", "{}", old);
    const removed = cleanupExpiredMemory(tmpDir, "persistent");
    expect(removed).toHaveLength(0);
  });

  it("deletes files from disk after cleanup", () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const p = writeFile("gone.json", "{}", old);
    cleanupExpiredMemory(tmpDir, "session");
    expect(fs.existsSync(p)).toBe(false);
  });
});
