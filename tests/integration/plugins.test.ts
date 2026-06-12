import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BlueprintIR } from "../../src/plugin/index.js";
import type { PluginRunPayload } from "../../src/plugins/context.js";
import { loadPlugins, pluginOutcomeErrors } from "../../src/plugins/loader.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-plugins-int-"));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writePlugin(name: string, source: string): string {
  const file = path.join(tmpDir, `${name}.mjs`);
  fs.writeFileSync(file, source, "utf-8");
  return `./${name}.mjs`;
}

function makePayload(): PluginRunPayload {
  return {
    blueprint: {
      version: "2.0",
      spatial_anchor: { project_name: "t", surface: "", temporal_anchor: "", conventions: [] },
      personas: [],
      rules: [{ id: "r1", scope: "**/*", severity: "hard", action: "no secrets" }],
      skills: [],
      hooks: [],
      meta: {
        rule_precedence: [],
        conflict_resolution: "",
        source_backend: "claude",
        target_backend: "claude",
      },
    } as BlueprintIR,
    files: [
      {
        path: path.join(tmpDir, ".claude/rules/r1.md"),
        layer: "rules",
        frontmatter: { severity: "hard" },
        body: "Body",
        fieldLines: { severity: 3 },
      },
    ],
    levels: ["structural", "semantic", "logical", "enforcement"],
  };
}

const HAPPY_PLUGIN = `
export default {
  name: "happy",
  version: "1.0.0",
  validators: [
    {
      id: "flag-hard-rules",
      level: "semantic",
      check(ctx) {
        for (const file of ctx.files) {
          if (file.layer === "rules" && file.frontmatter.severity === "hard") {
            ctx.error(file.path, file.lineOf("severity"), "hard rule found", "review it");
          }
        }
      },
    },
  ],
};
`;

describe("plugin engines (integration)", () => {
  it("runs a plugin and reports diagnostics in both modes identically", async () => {
    const rel = writePlugin("happy", HAPPY_PLUGIN);
    const [inline] = await loadPlugins([{ path: rel, mode: "inline" }], makePayload(), tmpDir);
    const [isolated] = await loadPlugins([{ path: rel, mode: "isolated" }], makePayload(), tmpDir);

    expect(inline?.kind).toBe("ok");
    expect(isolated?.kind).toBe("ok");
    if (inline?.kind !== "ok" || isolated?.kind !== "ok") return;
    expect(inline.result.diagnostics).toEqual(isolated.result.diagnostics);
    expect(inline.result.diagnostics).toHaveLength(1);
    expect(inline.result.diagnostics[0]).toMatchObject({
      severity: "error",
      line: 3,
      validatorId: "flag-hard-rules",
    });
  }, 30_000);

  it("filters validators by requested levels", async () => {
    const rel = writePlugin("happy2", HAPPY_PLUGIN);
    const payload = { ...makePayload(), levels: ["structural" as const] };
    const [outcome] = await loadPlugins([{ path: rel, mode: "inline" }], payload, tmpDir);
    expect(outcome?.kind).toBe("ok");
    if (outcome?.kind === "ok") expect(outcome.result.diagnostics).toHaveLength(0);
  });

  it("terminates an infinite-loop plugin at the timeout (isolated)", async () => {
    const rel = writePlugin(
      "spin",
      `export default { name: "spin", version: "1.0.0", validators: [
        { id: "spin", level: "semantic", check() { while (true) {} } },
      ] };`
    );
    const happy = writePlugin("happy3", HAPPY_PLUGIN);
    const outcomes = await loadPlugins(
      [
        { path: rel, mode: "isolated" },
        { path: happy, mode: "isolated" },
      ],
      makePayload(),
      tmpDir,
      { timeoutMs: 1_500 }
    );
    expect(outcomes[0]?.kind).toBe("timeout");
    // Other plugins still report after a timeout kill.
    expect(outcomes[1]?.kind).toBe("ok");
    const errors = outcomes.flatMap((o) => pluginOutcomeErrors(o, tmpDir));
    expect(errors.some((e) => e.type === "PLUGIN_TIMEOUT")).toBe(true);
    expect(errors.some((e) => e.type === "PLUGIN_HAPPY_FLAG_HARD_RULES")).toBe(true);
  }, 30_000);

  it("kills a runaway-allocation plugin via resource limits (isolated)", async () => {
    const rel = writePlugin(
      "hog",
      `export default { name: "hog", version: "1.0.0", validators: [
        { id: "hog", level: "semantic", check() {
          const chunks = [];
          while (true) { chunks.push(new Array(1_000_000).fill("x")); }
        } },
      ] };`
    );
    const [outcome] = await loadPlugins([{ path: rel, mode: "isolated" }], makePayload(), tmpDir, {
      timeoutMs: 20_000,
      maxOldGenerationSizeMb: 32,
    });
    expect(outcome?.kind).toBe("load-error");
  }, 30_000);

  it("contains a synchronously-throwing validator as a single PLUGIN_CRASHED error", async () => {
    const crash = writePlugin(
      "crash",
      `export default { name: "crash", version: "1.0.0", validators: [
        { id: "boom", level: "semantic", check() { throw new TypeError("kaboom"); } },
      ] };`
    );
    const happy = writePlugin("happy4", HAPPY_PLUGIN);
    const outcomes = await loadPlugins(
      [
        { path: crash, mode: "isolated" },
        { path: happy, mode: "isolated" },
      ],
      makePayload(),
      tmpDir
    );
    expect(outcomes[0]?.kind).toBe("ok");
    if (outcomes[0]?.kind === "ok") {
      expect(outcomes[0].result.crash?.message).toContain("kaboom");
    }
    expect(outcomes[1]?.kind).toBe("ok");

    const crashErrors = outcomes[0] ? pluginOutcomeErrors(outcomes[0], tmpDir) : [];
    expect(crashErrors.filter((e) => e.type === "PLUGIN_CRASHED")).toHaveLength(1);
  }, 30_000);

  it("reports a load error for a plugin without a valid default export", async () => {
    const rel = writePlugin("bad", `export const nope = 1;`);
    const [outcome] = await loadPlugins([{ path: rel, mode: "inline" }], makePayload(), tmpDir);
    expect(outcome?.kind).toBe("load-error");
  });

  it("gives plugins frozen context data and leaves the host payload untouched", async () => {
    const rel = writePlugin(
      "mutator",
      `export default { name: "mutator", version: "1.0.0", validators: [
        { id: "mutate", level: "semantic", check(ctx) {
          let frozen = true;
          try { ctx.blueprint.rules.push({ id: "evil" }); frozen = false; } catch {}
          try { ctx.files[0].frontmatter.severity = "soft"; frozen = false; } catch {}
          ctx.info("payload", frozen ? "frozen" : "mutable");
        } },
      ] };`
    );
    const payload = makePayload();
    for (const mode of ["inline", "isolated"] as const) {
      const [outcome] = await loadPlugins([{ path: rel, mode }], payload, tmpDir);
      expect(outcome?.kind).toBe("ok");
      if (outcome?.kind === "ok") {
        expect(outcome.result.diagnostics[0]?.message).toBe("frozen");
      }
    }
    // Host payload untouched by either mode.
    expect(payload.blueprint.rules).toHaveLength(1);
    expect(payload.files[0]?.frontmatter.severity).toBe("hard");
    expect(Object.isFrozen(payload.blueprint)).toBe(false);
  }, 30_000);

  it("flags plugins outside the project root with a path-escape outcome", async () => {
    const outside = path.join(os.tmpdir(), "bp-outside-plugin.mjs");
    fs.writeFileSync(outside, HAPPY_PLUGIN, "utf-8");
    try {
      const outcomes = await loadPlugins(
        [
          { path: "../escape.mjs", mode: "inline" },
          { path: outside, mode: "inline" },
        ],
        makePayload(),
        tmpDir
      );
      expect(outcomes[0]?.kind).toBe("path-escape");
      expect(outcomes[1]?.kind).toBe("path-escape");
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});
