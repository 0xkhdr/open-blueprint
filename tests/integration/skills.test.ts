import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detect } from "../../src/detector/index.js";
import { installPackToProject, loadPackLock, removePack } from "../../src/packs/materialize.js";
import { resolvePack } from "../../src/packs/store.js";
import { resolveTemplatePack } from "../../src/templater/selector.js";
import { EXIT_CODES, exitCodeForResult, runValidator } from "../../src/validator/index.js";

const FIXTURE = path.join(path.dirname(new URL(import.meta.url).pathname), "../fixtures/skills");

describe("skill lifecycle (Stage 3 integration)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-skills-int-"));
    fs.cpSync(FIXTURE, tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function claudeManifest() {
    const fingerprint = await detect(tmpDir);
    return { fingerprint, manifest: resolveTemplatePack(fingerprint, "claude").manifest };
  }

  async function verify(level: "semantic" | "all" = "semantic") {
    const { fingerprint, manifest } = await claudeManifest();
    return runValidator({ level, projectRoot: tmpDir, manifest, fingerprint });
  }

  it("runs the full pack:install→verify→remove lifecycle (acceptance 3)", async () => {
    const { manifest } = await claudeManifest();
    const loaded = await resolvePack("acme-skills", tmpDir);
    expect(loaded?.source).toBe("project");
    if (!loaded) throw new Error("unreachable");

    // Install: skill files materialize through the claude backend manifest.
    const result = await installPackToProject(loaded, { projectRoot: tmpDir, manifest });
    expect(result.written.sort()).toEqual([
      ".claude/skills/pack-acme-skills-endpoint-smoke.md",
      ".claude/skills/pack-acme-skills-rollback-release.md",
    ]);

    // Lockfile records the install with skill counts.
    const lock = await loadPackLock(tmpDir);
    expect(lock.installed.map((e) => e.id)).toEqual(["acme-skills"]);
    expect(lock.installed[0]?.kind).toBe("skills");
    expect(lock.installed[0]?.skills_count).toBe(2);

    // Verify: installed pack skills pass the skill validation layer.
    const passing = await verify();
    expect(passing.errors.filter((e) => e.type.startsWith("SKILL_"))).toEqual([]);
    expect(exitCodeForResult(passing)).toBe(EXIT_CODES.SUCCESS);

    // Remove: files and lock entry go away cleanly.
    const removed = await removePack("acme-skills", { projectRoot: tmpDir });
    expect(removed.removed).toHaveLength(2);
    expect((await loadPackLock(tmpDir)).installed).toHaveLength(0);
  });

  it("bp verify flags invalid skills at the semantic level (acceptance 1+2)", async () => {
    fs.mkdirSync(path.join(tmpDir, ".claude/skills"), { recursive: true });
    // Missing when_to_use + unknown tool + no numbered procedure.
    fs.writeFileSync(
      path.join(tmpDir, ".claude/skills/broken.md"),
      "---\nname: broken\ndescription: d\ntools_required: [teleport]\n---\nDo things.\n",
      "utf-8"
    );

    const failing = await verify();
    const types = failing.errors.map((e) => e.type);
    expect(types).toContain("SKILL_SCHEMA_INVALID");
    expect(types).toContain("SKILL_UNKNOWN_TOOL");
    expect(types).toContain("SKILL_NO_PROCEDURE");
    expect(exitCodeForResult(failing)).toBe(EXIT_CODES.SEMANTIC_FAILURE);
  });

  it("bp verify flags duplicate skill names across files", async () => {
    const skill =
      "---\nname: dupe\ndescription: d\nwhen_to_use: w\ntools_required: []\n---\n1. step\n";
    fs.mkdirSync(path.join(tmpDir, ".claude/skills"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".claude/skills/a.md"), skill, "utf-8");
    fs.writeFileSync(path.join(tmpDir, ".claude/skills/b.md"), skill, "utf-8");

    const failing = await verify();
    expect(failing.errors.some((e) => e.type === "SKILL_NAME_COLLISION")).toBe(true);
  });
});
