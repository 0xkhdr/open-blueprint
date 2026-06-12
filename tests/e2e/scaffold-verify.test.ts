import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTmpDir, runBp } from "./setup.js";

/**
 * Regression guard for the first-run experience: a fresh `bp init <backend>`
 * followed by `bp verify` must exit 0 for every bundled backend template,
 * and must not litter the repository root with stray files.
 */

const BUNDLED_BACKENDS = ["claude", "cursor", "generic", "opendev"] as const;

function scaffoldProject(dir: string): void {
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "smoke", version: "1.0.0", scripts: { test: "vitest" } }, null, 2)
  );
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src/index.ts"), "export {};\n");
}

describe("E2E: fresh scaffold verifies clean", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    scaffoldProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const backend of BUNDLED_BACKENDS) {
    it(`${backend}: bp init → bp verify exits 0`, { timeout: 60000 }, () => {
      const init = runBp(`init ${backend}`, tmpDir);
      expect(init.exitCode, `init stderr: ${init.stderr}`).toBe(0);

      const verify = runBp("verify", tmpDir);
      expect(verify.exitCode, `verify output: ${verify.stdout}\n${verify.stderr}`).toBe(0);
    });
  }

  it("claude: bp verify --json emits parseable JSON on stdout", { timeout: 60000 }, () => {
    const init = runBp("init claude", tmpDir);
    expect(init.exitCode).toBe(0);

    const verify = runBp("verify --json", tmpDir);
    expect(verify.exitCode, `stderr: ${verify.stderr}`).toBe(0);
    const parsed = JSON.parse(verify.stdout) as { passed: boolean };
    expect(parsed.passed).toBe(true);
  });

  it(
    "claude: --entropy-scan and .bp.json scan.entropyEnabled flag high-entropy strings",
    { timeout: 120000 },
    () => {
      const init = runBp("init claude", tmpDir);
      expect(init.exitCode).toBe(0);

      // Plant a high-entropy token in a scaffolded rules file.
      const rulesDir = path.join(tmpDir, ".claude/rules");
      const ruleFile = path.join(rulesDir, fs.readdirSync(rulesDir)[0] as string);
      fs.appendFileSync(ruleFile, "\ntoken: xK9!mP2$nQ7@wR4#vL6_zA3-bC8*dE5fG\n");

      type VerifyJson = { warnings: Array<{ type: string }> };
      const findEntropy = (out: string): number =>
        (JSON.parse(out) as VerifyJson).warnings.filter((w) => w.type === "HIGH_ENTROPY_STRING")
          .length;

      // Off by default.
      const plain = runBp("verify --json", tmpDir);
      expect(findEntropy(plain.stdout)).toBe(0);

      // Enabled via flag.
      const flagged = runBp("verify --entropy-scan --json", tmpDir);
      expect(findEntropy(flagged.stdout)).toBeGreaterThan(0);

      // Enabled via .bp.json scan.entropyEnabled.
      const configPath = path.join(tmpDir, ".bp.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
      config.scan = { entropyEnabled: true };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const viaConfig = runBp("verify --json", tmpDir);
      expect(findEntropy(viaConfig.stdout)).toBeGreaterThan(0);
    }
  );

  it("claude: scaffold does not write stray files at the repository root", { timeout: 60000 }, () => {
    const init = runBp("init claude", tmpDir);
    expect(init.exitCode).toBe(0);

    const rootEntries = fs.readdirSync(tmpDir);
    const allowedRootFiles = new Set([
      "package.json",
      "src",
      "CLAUDE.md",
      ".claude",
      ".bp",
      ".bp.json",
      ".bp-fingerprint.json",
      ".blueprintignore",
    ]);
    const stray = rootEntries.filter((e) => !allowedRootFiles.has(e));
    expect(stray).toEqual([]);

    // Risk-tier rules belong inside the backend rules directory.
    expect(fs.existsSync(path.join(tmpDir, ".claude/rules/rules-minimal.md"))).toBe(true);
  });
});
