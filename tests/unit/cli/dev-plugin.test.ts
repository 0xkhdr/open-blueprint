import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDevCommand } from "../../../src/cli/commands/dev.js";
import { detect } from "../../../src/detector/index.js";
import { runTemplater } from "../../../src/templater/index.js";

const FIXTURE_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "../../fixtures");

async function runDev(args: string[]): Promise<void> {
  const cmd = createDevCommand();
  await cmd.parseAsync(args, { from: "user" });
}

describe("bp dev plugin:scaffold", () => {
  let tmpDir: string;
  let prevCwd: string;

  beforeEach(() => {
    prevCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-dev-scaffold-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(prevCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a runnable plugin file in the target directory", async () => {
    await runDev(["plugin:scaffold", "my-checks"]);
    const file = path.join(tmpDir, "plugins", "my-checks.mjs");
    expect(fs.existsSync(file)).toBe(true);
    const source = fs.readFileSync(file, "utf-8");
    expect(source).toContain('name: "my-checks"');
    expect(source).toContain("require-rationale-on-hard-rules");
    expect(source).toContain("@agentic/bp/plugin");
  });

  it("honours --dir", async () => {
    await runDev(["plugin:scaffold", "custom", "--dir", "tools/bp"]);
    expect(fs.existsSync(path.join(tmpDir, "tools/bp/custom.mjs"))).toBe(true);
  });

  it("refuses to overwrite an existing plugin file", async () => {
    await runDev(["plugin:scaffold", "dupe"]);
    await expect(runDev(["plugin:scaffold", "dupe"])).rejects.toThrow();
  });

  it("rejects invalid plugin names", async () => {
    await expect(runDev(["plugin:scaffold", "bad name!"])).rejects.toThrow();
    expect(fs.existsSync(path.join(tmpDir, "plugins"))).toBe(false);
  });
});

describe("bp dev plugin:test", () => {
  let projectDir: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-dev-plugin-test-"));
    const fingerprint = await detect(path.join(FIXTURE_DIR, "node-express"));
    await runTemplater(fingerprint, projectDir, {
      backend: "claude",
      dryRun: false,
      force: false,
    });
    process.chdir(projectDir);
  });

  afterEach(() => {
    process.chdir(prevCwd);
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it("rejects an invalid --mode", async () => {
    await expect(runDev(["plugin:test", "./x.mjs", "--mode", "warp"])).rejects.toThrow();
  });

  it("succeeds when the plugin reports no errors", async () => {
    fs.writeFileSync(
      path.join(projectDir, "quiet.mjs"),
      `export default { name: "quiet", version: "1.0.0", validators: [
        { id: "noop", level: "semantic", check() {} },
      ] };`,
      "utf-8"
    );
    await expect(runDev(["plugin:test", "./quiet.mjs", "--mode", "inline"])).resolves.not.toThrow();
  }, 30_000);

  it("throws PLUGIN_TEST_FAILED when the plugin reports errors", async () => {
    fs.writeFileSync(
      path.join(projectDir, "loud.mjs"),
      `export default { name: "loud", version: "1.0.0", validators: [
        { id: "always", level: "semantic", check(ctx) {
          ctx.error("CLAUDE.md", undefined, "nope", "fix");
        } },
      ] };`,
      "utf-8"
    );
    await expect(runDev(["plugin:test", "./loud.mjs", "--mode", "inline"])).rejects.toThrow(
      /Plugin reported errors/
    );
  }, 30_000);
});
