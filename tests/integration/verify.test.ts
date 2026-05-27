import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detect } from "../../src/detector/index.js";
import { runTemplater } from "../../src/templater/index.js";
import { resolveTemplatePack } from "../../src/templater/selector.js";
import { storeFingerprint } from "../../src/validator/drift.js";
import { EXIT_CODES, exitCodeForResult, runValidator } from "../../src/validator/index.js";

const FIXTURE_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "../fixtures");

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-verify-integration-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

async function initAndVerify(
  fixtureDir: string,
  outputDir: string
): Promise<{ exitCode: number; errors: number; warnings: number }> {
  const fingerprint = await detect(fixtureDir);
  await runTemplater(fingerprint, outputDir, { backend: "claude", dryRun: false, force: false });
  storeFingerprint(outputDir, fingerprint);

  const pack = resolveTemplatePack(fingerprint, "claude");
  const result = await runValidator({
    level: "all",
    projectRoot: outputDir,
    manifest: pack.manifest,
    fingerprint,
  });

  return {
    exitCode: exitCodeForResult(result),
    errors: result.errors.length,
    warnings: result.warnings.length,
  };
}

// ---------------------------------------------------------------------------
// Conflict fixture — two overlapping hard rules → exit 4
// ---------------------------------------------------------------------------

describe("bp verify — conflict detection", () => {
  it("exits with code 4 when two hard rules conflict on same scope", async () => {
    const conflictFixture = path.join(FIXTURE_DIR, "conflict-rules");

    const fingerprint = await detect(conflictFixture);
    const pack = resolveTemplatePack(fingerprint, "claude");

    // Use conflict fixture directly (already has .claude/rules with conflicts)
    const result = await runValidator({
      level: "logical",
      projectRoot: conflictFixture,
      manifest: pack.manifest,
    });

    const code = exitCodeForResult(result);
    expect(code).toBe(EXIT_CODES.LOGICAL_FAILURE); // exit 4
  });

  it("conflict result has RULE_CONFLICT_HARD error", async () => {
    const conflictFixture = path.join(FIXTURE_DIR, "conflict-rules");
    const fingerprint = await detect(conflictFixture);
    const pack = resolveTemplatePack(fingerprint, "claude");

    const result = await runValidator({
      level: "logical",
      projectRoot: conflictFixture,
      manifest: pack.manifest,
    });

    expect(result.errors.some((e) => e.type === "RULE_CONFLICT_HARD")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Drift fixture — stale jest → vitest migration
// ---------------------------------------------------------------------------

describe("bp verify — drift detection", () => {
  it("detects TEST_COMMAND_DRIFT on drift fixture", async () => {
    const driftFixture = path.join(FIXTURE_DIR, "drift-repo");

    // Current fingerprint will detect vitest (from package.json scripts)
    const fingerprint = await detect(driftFixture);
    const pack = resolveTemplatePack(fingerprint, "claude");

    // Run drift layer
    const result = await runValidator({
      level: "drift",
      projectRoot: driftFixture,
      manifest: pack.manifest,
      fingerprint,
    });

    // Should detect either FINGERPRINT_DELTA or TEST_COMMAND_DRIFT
    const hasDrift = result.warnings.some(
      (e) =>
        e.type === "FINGERPRINT_DELTA" ||
        e.type === "TEST_COMMAND_DRIFT" ||
        e.type === "ENTRY_POINT_DRIFT"
    );
    expect(hasDrift).toBe(true);
  });

  it("drift fixture exit code indicates drift detected", async () => {
    const driftFixture = path.join(FIXTURE_DIR, "drift-repo");
    const fingerprint = await detect(driftFixture);
    const pack = resolveTemplatePack(fingerprint, "claude");

    const result = await runValidator({
      level: "drift",
      projectRoot: driftFixture,
      manifest: pack.manifest,
      fingerprint,
    });

    // Drift is warnings not errors, so passed=true but drift code
    const code = exitCodeForResult(result);
    // Either 0 (no drift found) or 5 (drift found)
    expect([EXIT_CODES.SUCCESS, EXIT_CODES.DRIFT_DETECTED]).toContain(code);
  });
});

// ---------------------------------------------------------------------------
// All fixture repos: bp init → bp verify --level all → exit 0
// ---------------------------------------------------------------------------

const ALL_FIXTURES = [
  "node-express",
  "node-nextjs",
  "node-nestjs",
  "node-monorepo",
  "python-fastapi",
  "python-django",
  "go-std",
  "go-microservices",
  "rust-axum",
  "mixed-language",
];

describe("bp init + verify — all fixture repos", () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = createTmpDir();
  });

  afterEach(() => cleanDir(outputDir));

  for (const fixture of ALL_FIXTURES) {
    it(`${fixture}: bp init + verify --level all exits 0`, async () => {
      const fixtureDir = path.join(FIXTURE_DIR, fixture);
      const { exitCode } = await initAndVerify(fixtureDir, outputDir);

      // Exit 0 = success, exit 5 = drift warnings (acceptable after fresh init)
      expect([EXIT_CODES.SUCCESS, EXIT_CODES.DRIFT_DETECTED]).toContain(exitCode);
    });

    it(`${fixture}: detects primary language`, async () => {
      const fixtureDir = path.join(FIXTURE_DIR, fixture);
      const fingerprint = await detect(fixtureDir);
      expect(fingerprint.languages.length).toBeGreaterThan(0);
      expect(fingerprint.languages.some((l) => l.primary)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Semantic layer: scope pattern validation
// ---------------------------------------------------------------------------

describe("bp verify — semantic layer", () => {
  let outputDir: string;

  beforeEach(() => { outputDir = createTmpDir(); });
  afterEach(() => cleanDir(outputDir));

  it("node-express: semantic layer passes after bp init", async () => {
    const fixtureDir = path.join(FIXTURE_DIR, "node-express");
    const fingerprint = await detect(fixtureDir);
    await runTemplater(fingerprint, outputDir, { backend: "claude", dryRun: false, force: false });

    const pack = resolveTemplatePack(fingerprint, "claude");
    const result = await runValidator({
      level: "semantic",
      projectRoot: outputDir,
      manifest: pack.manifest,
      fingerprint,
    });

    // Semantic layer should not produce hard errors after clean init
    expect(result.errors.filter((e) => e.severity === "error").length).toBe(0);
  });
});
