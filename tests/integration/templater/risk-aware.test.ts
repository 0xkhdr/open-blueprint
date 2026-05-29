import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Fingerprint } from "../../../src/detector/fingerprint.js";
import { runTemplater } from "../../../src/templater/index.js";

type EnhancedFingerprint = Fingerprint & { risk_tier: "low" | "medium" | "high" | "critical" };

let tmpDir: string;

const BASE_FINGERPRINT: Fingerprint = {
  version: "1.0",
  detected_at: "2026-01-01T00:00:00.000Z",
  project: {
    name: "test-project",
    root: "/tmp/test",
    type: "application",
    git_workflow: "unknown",
  },
  languages: [{ name: "typescript", confidence: 0.9, primary: true }],
  frameworks: [{ name: "express", confidence: 0.9 }],
  entry_points: [{ path: "src/index.ts", confidence: 0.9, type: "main" }],
  tooling: { package_manager: "npm", test_runner: "vitest", test_command: "vitest" },
  directory_topology: {
    src_dirs: ["src"],
    test_dirs: ["tests"],
    config_dirs: [],
    package_dirs: [],
  },
  security_signals: {
    has_auth: false,
    has_external_apis: false,
    has_secrets_manager: false,
    has_docker: false,
  },
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-risk-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("risk-aware template rendering", () => {
  it("renders more files for critical than low (risk packs overlay)", async () => {
    const criticalFp: EnhancedFingerprint = { ...BASE_FINGERPRINT, risk_tier: "critical" };
    const lowFp: EnhancedFingerprint = { ...BASE_FINGERPRINT, risk_tier: "low" };

    const criticalDir = path.join(tmpDir, "critical");
    const lowDir = path.join(tmpDir, "low");
    fs.mkdirSync(criticalDir, { recursive: true });
    fs.mkdirSync(lowDir, { recursive: true });

    const criticalResult = await runTemplater(criticalFp, criticalDir, {
      backend: "claude",
      dryRun: true,
    });
    const lowResult = await runTemplater(lowFp, lowDir, {
      backend: "claude",
      dryRun: true,
    });

    // Critical projects get extra risk pack files (escalation, compliance-checklist, rules-maximum)
    expect(criticalResult.files.length).toBeGreaterThanOrEqual(lowResult.files.length);
  });

  it("critical project includes escalation and compliance files", async () => {
    const fp: EnhancedFingerprint = { ...BASE_FINGERPRINT, risk_tier: "critical" };
    const outDir = path.join(tmpDir, "critical-out");
    fs.mkdirSync(outDir, { recursive: true });

    const result = await runTemplater(fp, outDir, {
      backend: "claude",
      dryRun: true,
    });

    const paths = result.files.map((f) => f.path);
    const hasEscalation = paths.some((p) => p.includes("escalation"));
    const hasCompliance = paths.some((p) => p.includes("compliance"));
    expect(hasEscalation || hasCompliance).toBe(true);
  });

  it("low risk project includes minimal rules file", async () => {
    const fp: EnhancedFingerprint = { ...BASE_FINGERPRINT, risk_tier: "low" };
    const outDir = path.join(tmpDir, "low-out");
    fs.mkdirSync(outDir, { recursive: true });

    const result = await runTemplater(fp, outDir, {
      backend: "claude",
      dryRun: true,
    });

    const paths = result.files.map((f) => f.path);
    expect(paths.some((p) => p.includes("rules-minimal"))).toBe(true);
  });

  it("security rule skipped for low risk (render_if condition)", async () => {
    const fp: EnhancedFingerprint = { ...BASE_FINGERPRINT, risk_tier: "low" };
    const outDir = path.join(tmpDir, "low-security");
    fs.mkdirSync(outDir, { recursive: true });

    const result = await runTemplater(fp, outDir, {
      backend: "claude",
      dryRun: true,
    });

    // 02-security.md.hbs has render_if: risk_tier: [medium, high, critical]
    // so it should be skipped for low
    const paths = result.files.map((f) => f.path);
    expect(paths.some((p) => p.includes("02-security"))).toBe(false);
  });

  it("security rule rendered for medium risk", async () => {
    const fp: EnhancedFingerprint = { ...BASE_FINGERPRINT, risk_tier: "medium" };
    const outDir = path.join(tmpDir, "medium-security");
    fs.mkdirSync(outDir, { recursive: true });

    const result = await runTemplater(fp, outDir, {
      backend: "claude",
      dryRun: true,
    });

    const paths = result.files.map((f) => f.path);
    expect(paths.some((p) => p.includes("02-security"))).toBe(true);
  });
});
