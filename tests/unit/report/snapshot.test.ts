import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REPORT_SNAPSHOT_FILE } from "../../../src/report/model.js";
import {
  buildSnapshot,
  findStaleManualRules,
  loadSnapshot,
  saveSnapshot,
  scopeChangeRatio,
} from "../../../src/report/snapshot.js";
import type { RuleOutcome } from "../../../src/validator/enforcement.js";

describe("scopeChangeRatio", () => {
  it("is 0 for identical sets and empty baselines", () => {
    expect(scopeChangeRatio({}, {})).toBe(0);
    expect(scopeChangeRatio({ "a.ts": "x" }, { "a.ts": "x" })).toBe(0);
    expect(scopeChangeRatio({}, { "new.ts": "x" })).toBe(0);
  });

  it("counts modified, removed and added files against the baseline size", () => {
    const baseline = { "a.ts": "1", "b.ts": "2", "c.ts": "3", "d.ts": "4" };
    // one modified
    expect(scopeChangeRatio(baseline, { ...baseline, "a.ts": "changed" })).toBe(0.25);
    // one removed
    expect(scopeChangeRatio(baseline, { "b.ts": "2", "c.ts": "3", "d.ts": "4" })).toBe(0.25);
    // one added
    expect(scopeChangeRatio(baseline, { ...baseline, "e.ts": "5" })).toBe(0.25);
    // everything churned
    expect(scopeChangeRatio(baseline, {})).toBe(1);
  });
});

describe("snapshot lifecycle + staleness comparator", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-snapshot-"));
    fs.mkdirSync(path.join(tmpDir, ".claude/rules"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude/rules/manual.md"),
      '---\nid: manual-control\nscope: "src/**/*.ts"\nseverity: hard\naction: "review crypto"\n---\n\n# Manual\n'
    );
    for (const name of ["a.ts", "b.ts", "c.ts", "d.ts"]) {
      fs.writeFileSync(path.join(tmpDir, "src", name), `export const v = "${name}";\n`);
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function manualOutcome(): RuleOutcome {
    return {
      id: "manual-control",
      file: path.join(tmpDir, ".claude/rules/manual.md"),
      severity: "hard",
      enforcement: "manual",
      status: "manual",
      scope: "src/**/*.ts",
    };
  }

  it("round-trips through save/load and only records manual rules", async () => {
    const autoOutcome: RuleOutcome = { ...manualOutcome(), id: "auto", status: "pass" };
    const snapshot = await buildSnapshot(tmpDir, [manualOutcome(), autoOutcome]);
    expect(Object.keys(snapshot.manual_rules)).toEqual(["manual-control"]);
    expect(Object.keys(snapshot.manual_rules["manual-control"]?.scope_files ?? {})).toHaveLength(4);

    await saveSnapshot(tmpDir, snapshot);
    expect(fs.existsSync(path.join(tmpDir, REPORT_SNAPSHOT_FILE))).toBe(true);
    expect(await loadSnapshot(tmpDir)).toEqual(snapshot);
  });

  it("returns null for a missing or corrupt snapshot", async () => {
    expect(await loadSnapshot(tmpDir)).toBeNull();
    fs.mkdirSync(path.join(tmpDir, ".bp"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, REPORT_SNAPSHOT_FILE), "{not json");
    expect(await loadSnapshot(tmpDir)).toBeNull();
  });

  it("flags a manual rule stale when its scoped files churn but the rule does not", async () => {
    const snapshot = await buildSnapshot(tmpDir, [manualOutcome()]);

    // 2 of 4 scoped files change → ratio 0.5 ≥ 0.25
    fs.writeFileSync(path.join(tmpDir, "src/a.ts"), "export const v = 'rewritten';\n");
    fs.writeFileSync(path.join(tmpDir, "src/b.ts"), "export const v = 'rewritten';\n");

    const stale = await findStaleManualRules(tmpDir, snapshot, [manualOutcome()]);
    expect(stale.has("manual-control")).toBe(true);
  });

  it("does not flag when the rule itself was updated alongside the code", async () => {
    const snapshot = await buildSnapshot(tmpDir, [manualOutcome()]);
    fs.writeFileSync(path.join(tmpDir, "src/a.ts"), "changed\n");
    fs.writeFileSync(path.join(tmpDir, "src/b.ts"), "changed\n");
    fs.writeFileSync(
      path.join(tmpDir, ".claude/rules/manual.md"),
      '---\nid: manual-control\nscope: "src/**/*.ts"\nseverity: hard\naction: "review crypto, incl. new modules"\n---\n\n# Manual v2\n'
    );

    const stale = await findStaleManualRules(tmpDir, snapshot, [manualOutcome()]);
    expect(stale.size).toBe(0);
  });

  it("does not flag below the change-ratio threshold or without a baseline entry", async () => {
    const snapshot = await buildSnapshot(tmpDir, [manualOutcome()]);

    // 0 of 4 changed
    expect((await findStaleManualRules(tmpDir, snapshot, [manualOutcome()])).size).toBe(0);

    // unknown rule id → skipped
    const unknown: RuleOutcome = { ...manualOutcome(), id: "other" };
    expect((await findStaleManualRules(tmpDir, snapshot, [unknown])).size).toBe(0);
  });
});
