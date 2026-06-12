import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detect } from "../../src/detector/index.js";
import {
  installPackToProject,
  loadPackLock,
  removePack,
} from "../../src/packs/materialize.js";
import { loadPackFromFile, resolvePack } from "../../src/packs/store.js";
import { resolveTemplatePack } from "../../src/templater/selector.js";
import { EXIT_CODES, exitCodeForResult, runValidator } from "../../src/validator/index.js";

const FIXTURE = path.join(path.dirname(new URL(import.meta.url).pathname), "../fixtures/packs");

describe("rule pack lifecycle (Stage 2 integration)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-packs-int-"));
    fs.cpSync(FIXTURE, tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function claudeManifest() {
    const fingerprint = await detect(tmpDir);
    return { fingerprint, manifest: resolveTemplatePack(fingerprint, "claude").manifest };
  }

  async function install(force = false) {
    const { manifest } = await claudeManifest();
    const loaded = await resolvePack("acme", tmpDir);
    expect(loaded?.source).toBe("project");
    if (!loaded) throw new Error("unreachable");
    return installPackToProject(loaded, { projectRoot: tmpDir, manifest, force });
  }

  it("runs the full create→lint→install→verify→remove lifecycle", async () => {
    // Lint: the hand-written fixture pack is valid.
    const packFile = path.join(tmpDir, ".bp/packs/acme.bp-pack.yaml");
    const { pack } = await loadPackFromFile(packFile);
    expect(pack.id).toBe("acme");
    expect(pack.rules).toHaveLength(2);

    // Install: rule files materialize through the claude backend manifest.
    const result = await install();
    expect(result.written.sort()).toEqual([
      ".claude/rules/pack-acme-docs-required.md",
      ".claude/rules/pack-acme-no-console.md",
    ]);
    const lock = await loadPackLock(tmpDir);
    expect(lock.installed.map((e) => e.id)).toEqual(["acme"]);

    // Verify (enforcement): the fixture's src/index.ts violates no-console (hard).
    const { fingerprint, manifest } = await claudeManifest();
    const failing = await runValidator({
      level: "enforcement",
      projectRoot: tmpDir,
      manifest,
      fingerprint,
    });
    expect(failing.passed).toBe(false);
    expect(exitCodeForResult(failing)).toBe(EXIT_CODES.STRUCTURAL_FAILURE);
    const violation = failing.errors.find((e) => e.type === "RULE_VIOLATION");
    expect(violation?.file).toContain("pack-acme-no-console.md");

    // Remediate and verify again: only the manual soft rule remains informational.
    fs.writeFileSync(
      path.join(tmpDir, "src/index.ts"),
      "export const greet = (n: string) => `Hello, ${n}!`;\n"
    );
    const passing = await runValidator({
      level: "enforcement",
      projectRoot: tmpDir,
      manifest,
      fingerprint,
    });
    expect(passing.errors.filter((e) => e.type === "RULE_VIOLATION")).toHaveLength(0);

    // Remove: files and lock entry cleaned up.
    const removed = await removePack("acme", { projectRoot: tmpDir });
    expect(removed.removed).toHaveLength(2);
    expect(fs.existsSync(path.join(tmpDir, ".claude/rules/pack-acme-no-console.md"))).toBe(false);
    expect((await loadPackLock(tmpDir)).installed).toHaveLength(0);
  });

  it("second install is byte-equal (idempotent)", async () => {
    await install();
    const file = path.join(tmpDir, ".claude/rules/pack-acme-no-console.md");
    const before = fs.readFileSync(file);

    const second = await install();
    expect(second.written).toEqual([]);
    expect(fs.readFileSync(file).equals(before)).toBe(true);
  });

  it("preserve blocks survive a forced re-install", async () => {
    await install();
    const file = path.join(tmpDir, ".claude/rules/pack-acme-no-console.md");
    fs.appendFileSync(file, "\n<!-- bp:preserve -->\nTeam-specific notes.\n<!-- bp:end-preserve -->\n");

    await install(true);
    expect(fs.readFileSync(file, "utf-8")).toContain("Team-specific notes.");
  });

  it("pack drift surfaces through bp verify at the drift level", async () => {
    await install();
    const file = path.join(tmpDir, ".claude/rules/pack-acme-docs-required.md");
    fs.appendFileSync(file, "\nEdited outside preserve blocks.\n");

    const { fingerprint, manifest } = await claudeManifest();
    const result = await runValidator({
      level: "drift",
      projectRoot: tmpDir,
      manifest,
      fingerprint,
    });
    expect(result.warnings.some((e) => e.type === "PACK_FILE_MODIFIED")).toBe(true);

    fs.rmSync(file);
    const after = await runValidator({ level: "drift", projectRoot: tmpDir, manifest, fingerprint });
    expect(after.warnings.some((e) => e.type === "PACK_FILE_MISSING")).toBe(true);
    expect(exitCodeForResult(after)).toBe(EXIT_CODES.DRIFT_DETECTED);
  });

  it("materialized files pass structural+semantic validation under bp verify", async () => {
    await install();
    fs.writeFileSync(
      path.join(tmpDir, "src/index.ts"),
      "export const greet = (n: string) => `Hello, ${n}!`;\n"
    );
    const { fingerprint, manifest } = await claudeManifest();
    const result = await runValidator({
      level: "semantic",
      projectRoot: tmpDir,
      manifest,
      fingerprint,
    });
    expect(result.errors).toEqual([]);
  });
});
