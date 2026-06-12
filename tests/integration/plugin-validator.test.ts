import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detect } from "../../src/detector/index.js";
import { runTemplater } from "../../src/templater/index.js";
import { resolveTemplatePack } from "../../src/templater/selector.js";
import { runValidator } from "../../src/validator/index.js";

const FIXTURE_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "../fixtures");

const FLAG_PLUGIN = `
export default {
  name: "demo",
  version: "1.0.0",
  validators: [
    {
      id: "always-flag",
      level: "semantic",
      check(ctx) {
        const first = ctx.files[0];
        if (first) {
          ctx.error(first.path, first.lineOf("severity"), "flagged by plugin", "remove flag");
        }
      },
    },
  ],
};
`;

let projectDir: string;

describe("plugin pipeline through runValidator", () => {
  beforeEach(async () => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-plugin-validator-"));
    const fingerprint = await detect(path.join(FIXTURE_DIR, "node-express"));
    await runTemplater(fingerprint, projectDir, {
      backend: "claude",
      dryRun: false,
      force: false,
    });
    fs.mkdirSync(path.join(projectDir, "plugins"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "plugins/demo.mjs"), FLAG_PLUGIN, "utf-8");
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  function writeConfig(plugins: unknown[]): void {
    fs.writeFileSync(
      path.join(projectDir, ".bp.json"),
      JSON.stringify({ backend: "claude", plugins }, null, 2),
      "utf-8"
    );
  }

  async function validate(options: { noPlugins?: boolean; level?: "all" | "drift" } = {}) {
    const fingerprint = await detect(projectDir);
    const pack = resolveTemplatePack(fingerprint, "claude");
    return runValidator({
      level: options.level ?? "all",
      projectRoot: projectDir,
      manifest: pack.manifest,
      fingerprint,
      ...(options.noPlugins ? { noPlugins: true } : {}),
    });
  }

  it("surfaces plugin diagnostics as PLUGIN_<NAME>_<ID> errors (isolated default)", async () => {
    writeConfig(["./plugins/demo.mjs"]);
    const result = await validate();
    const pluginError = result.errors.find((e) => e.type === "PLUGIN_DEMO_ALWAYS_FLAG");
    expect(pluginError).toBeDefined();
    expect(pluginError?.message).toBe("flagged by plugin");
    expect(pluginError?.resolution).toBe("remove flag");
  }, 30_000);

  it("runs inline-mode plugins configured via object entries", async () => {
    writeConfig([{ path: "./plugins/demo.mjs", mode: "inline" }]);
    const result = await validate();
    expect(result.errors.some((e) => e.type === "PLUGIN_DEMO_ALWAYS_FLAG")).toBe(true);
  }, 30_000);

  it("skips plugins when noPlugins is set (verify --no-plugins)", async () => {
    writeConfig([{ path: "./plugins/demo.mjs", mode: "inline" }]);
    const result = await validate({ noPlugins: true });
    expect(result.errors.some((e) => e.type.startsWith("PLUGIN_"))).toBe(false);
  }, 30_000);

  it("does not run plugins for levels without plugin participation", async () => {
    writeConfig([{ path: "./plugins/demo.mjs", mode: "inline" }]);
    const result = await validate({ level: "drift" });
    const all = [...result.errors, ...result.warnings];
    expect(all.some((e) => e.type.startsWith("PLUGIN_"))).toBe(false);
  }, 30_000);

  it("rejects plugin paths outside the project root with PLUGIN_PATH_ESCAPE", async () => {
    writeConfig([{ path: "../evil.mjs", mode: "inline" }]);
    const result = await validate();
    expect(result.errors.some((e) => e.type === "PLUGIN_PATH_ESCAPE")).toBe(true);
  }, 30_000);
});
