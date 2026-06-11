import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exitCodeForReport } from "../../src/cli/commands/report.js";
import { detect } from "../../src/detector/index.js";
import { installPackToProject } from "../../src/packs/materialize.js";
import { resolvePack } from "../../src/packs/store.js";
import { collectGovernanceReport } from "../../src/report/build.js";
import { GovernanceReportSchema } from "../../src/report/model.js";
import { reportToSarif } from "../../src/report/sarif.js";
import { buildSnapshot, saveSnapshot } from "../../src/report/snapshot.js";
import { resolveTemplatePack } from "../../src/templater/selector.js";
import { EXIT_CODES, runValidator } from "../../src/validator/index.js";

const FIXTURE = path.join(path.dirname(new URL(import.meta.url).pathname), "../fixtures/packs");
const SCHEMA_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../fixtures/sarif-schema-2.1.0.json"
);

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateSarif = ajv.compile(JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8")));

describe("bp report (Stage 6 integration)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-report-int-"));
    fs.cpSync(FIXTURE, tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function context() {
    const fingerprint = await detect(tmpDir);
    const manifest = resolveTemplatePack(fingerprint, "claude").manifest;
    return { fingerprint, manifest };
  }

  async function installAcme() {
    const { manifest } = await context();
    const loaded = await resolvePack("acme", tmpDir);
    if (!loaded) throw new Error("fixture pack missing");
    await installPackToProject(loaded, { projectRoot: tmpDir, manifest });
  }

  function addPassingProjectRule() {
    fs.mkdirSync(path.join(tmpDir, ".claude/rules"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude/rules/readme.md"),
      [
        "---",
        "id: readme-required",
        'scope: "**/*"',
        "severity: hard",
        'action: "Repository must have a README"',
        "check:",
        "  type: file-exists",
        '  glob: "README.md"',
        "---",
        "",
        "# README rule",
      ].join("\n")
    );
  }

  async function report() {
    const { fingerprint, manifest } = await context();
    return collectGovernanceReport({ projectRoot: tmpDir, manifest, backend: "claude", fingerprint });
  }

  it("acceptance 1+2: pass/fail/manual statuses, schema-valid JSON + SARIF, CI exit codes", async () => {
    await installAcme();
    addPassingProjectRule();

    const { report: governanceReport } = await report();

    // --json validates against bp-report/1
    expect(GovernanceReportSchema.parse(governanceReport)).toEqual(governanceReport);

    const byId = new Map(governanceReport.rules.map((r) => [r.id, r]));
    // project rule passes; pack rules: no-console fails hard, docs-required is manual
    expect(byId.get("readme-required")?.status).toBe("pass");
    expect(byId.get("no-console")).toMatchObject({
      status: "fail",
      severity: "hard",
      pack: { id: "acme", version: "1.0.0" },
    });
    expect(byId.get("docs-required")).toMatchObject({
      status: "manual",
      enforcement: "manual",
      pack: { id: "acme", version: "1.0.0" },
    });

    expect(governanceReport.summary).toMatchObject({
      rules_total: 3,
      rules_enforced: 2,
      rules_manual: 1,
      violations_hard: 1,
      violations_soft: 0,
      packs_installed: 1,
    });

    // measured pack posture replaces declared coverage
    const acme = governanceReport.packs.find((p) => p.id === "acme");
    expect(acme).toMatchObject({
      framework: "custom",
      integrity: "ok",
      measured: { pass: 0, fail: 1, manual: 1 },
    });

    // --sarif passes SARIF 2.1.0 schema validation with rules[] + located results[]
    const sarif = reportToSarif(governanceReport);
    expect(validateSarif(sarif)).toBe(true);
    expect(sarif.runs[0]?.tool.driver.rules.map((r) => r.id).sort()).toEqual([
      "docs-required",
      "no-console",
      "readme-required",
    ]);
    const result = sarif.runs[0]?.results[0];
    expect(result?.ruleId).toBe("no-console");
    expect(result?.locations[0]?.physicalLocation.artifactLocation.uri).toBe("src/index.ts");
    expect(result?.locations[0]?.physicalLocation.region?.startLine).toBeGreaterThan(0);

    // default --fail-on hard exits non-zero; fixing the repo clears it
    expect(exitCodeForReport(governanceReport, "hard")).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(exitCodeForReport(governanceReport, "none")).toBe(EXIT_CODES.SUCCESS);

    fs.writeFileSync(
      path.join(tmpDir, "src/index.ts"),
      'import { logger } from "./logger.js";\nlogger.info("ok");\n'
    );
    const { report: fixedReport } = await report();
    expect(exitCodeForReport(fixedReport, "hard")).toBe(EXIT_CODES.SUCCESS);
    expect(fixedReport.packs[0]?.measured).toEqual({ pass: 1, fail: 0, manual: 1 });
  });

  it("acceptance 3: in-place pack edit ⇒ integrity 'modified' + PACK_DRIFTED in verify", async () => {
    await installAcme();
    const ruleFile = path.join(tmpDir, ".claude/rules/pack-acme-no-console.md");
    fs.appendFileSync(ruleFile, "\nTampered outside preserve blocks.\n");

    const { report: governanceReport } = await report();
    expect(governanceReport.packs.find((p) => p.id === "acme")?.integrity).toBe("modified");

    const { fingerprint, manifest } = await context();
    const verify = await runValidator({
      level: "drift",
      projectRoot: tmpDir,
      manifest,
      fingerprint,
    });
    expect(verify.warnings.some((e) => e.type === "PACK_DRIFTED")).toBe(true);
    expect(verify.warnings.some((e) => e.type === "PACK_FILE_MODIFIED")).toBe(true);
  });

  it("acceptance 4: degrades gracefully without packs, skills or snapshot", async () => {
    addPassingProjectRule();

    const { report: governanceReport } = await report();
    expect(GovernanceReportSchema.parse(governanceReport)).toEqual(governanceReport);
    expect(governanceReport.packs).toEqual([]);
    expect(governanceReport.summary.packs_installed).toBe(0);
    expect(governanceReport.rules).toHaveLength(1);
    // claude backend supports skills: inventory present but empty
    expect(governanceReport.skills).toEqual([]);
    expect(governanceReport.rules[0]?.stale).toBeUndefined();
  });

  it("snapshot staleness: manual pack rule goes stale when scoped files churn", async () => {
    await installAcme();

    const { outcomes } = await report();
    await saveSnapshot(tmpDir, await buildSnapshot(tmpDir, outcomes));

    // docs-required scope is **/* — rewrite the source tree
    fs.writeFileSync(path.join(tmpDir, "src/index.ts"), "export const rewritten = 1;\n");
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Totally new readme\n");
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "renamed" }));

    const { report: after } = await report();
    expect(after.rules.find((r) => r.id === "docs-required")?.stale).toBe(true);
  });
});
