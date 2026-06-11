import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type PluginOutcome,
  pluginOutcomeErrors,
  resolvePluginPath,
} from "../../../src/plugins/loader.js";

const ROOT = path.resolve("/tmp/project");

describe("resolvePluginPath", () => {
  it("accepts a relative path inside the root", () => {
    const res = resolvePluginPath(ROOT, "./plugins/check.mjs");
    expect(res).toEqual({ ok: true, absolutePath: path.join(ROOT, "plugins/check.mjs") });
  });

  it("accepts an absolute path inside the root", () => {
    const inside = path.join(ROOT, "plugins/check.mjs");
    expect(resolvePluginPath(ROOT, inside)).toEqual({ ok: true, absolutePath: inside });
  });

  it("rejects .. escapes", () => {
    const res = resolvePluginPath(ROOT, "../outside.mjs");
    expect(res.ok).toBe(false);
  });

  it("rejects nested .. escapes", () => {
    const res = resolvePluginPath(ROOT, "plugins/../../outside.mjs");
    expect(res.ok).toBe(false);
  });

  it("rejects absolute paths outside the root", () => {
    const res = resolvePluginPath(ROOT, "/etc/evil.mjs");
    expect(res.ok).toBe(false);
  });

  it("rejects the root itself", () => {
    const res = resolvePluginPath(ROOT, ".");
    expect(res.ok).toBe(false);
  });
});

describe("pluginOutcomeErrors", () => {
  const spec = { path: "./plugins/check.mjs", mode: "isolated" as const };

  it("maps path escape to PLUGIN_PATH_ESCAPE", () => {
    const outcome: PluginOutcome = { kind: "path-escape", spec, message: "escape" };
    const errors = pluginOutcomeErrors(outcome, ROOT);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("PLUGIN_PATH_ESCAPE");
    expect(errors[0]?.severity).toBe("error");
  });

  it("maps timeout to PLUGIN_TIMEOUT", () => {
    const outcome: PluginOutcome = { kind: "timeout", spec, message: "timed out" };
    expect(pluginOutcomeErrors(outcome, ROOT)[0]?.type).toBe("PLUGIN_TIMEOUT");
  });

  it("maps load failure to PLUGIN_LOAD_ERROR", () => {
    const outcome: PluginOutcome = { kind: "load-error", spec, message: "boom" };
    expect(pluginOutcomeErrors(outcome, ROOT)[0]?.type).toBe("PLUGIN_LOAD_ERROR");
  });

  it("maps diagnostics to PLUGIN_<NAME>_<ID> types preserving location", () => {
    const outcome: PluginOutcome = {
      kind: "ok",
      spec,
      result: {
        pluginName: "acme-checks",
        pluginVersion: "1.0.0",
        diagnostics: [
          {
            file: "/repo/.claude/rules/r1.md",
            line: 3,
            severity: "error",
            message: "missing rationale",
            resolution: "add it",
            validatorId: "require-rationale",
          },
          {
            file: "/repo/CLAUDE.md",
            severity: "info",
            message: "fyi",
            resolution: "none",
            validatorId: "require-rationale",
          },
        ],
      },
    };
    const errors = pluginOutcomeErrors(outcome, ROOT);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      type: "PLUGIN_ACME_CHECKS_REQUIRE_RATIONALE",
      file: "/repo/.claude/rules/r1.md",
      line: 3,
      severity: "error",
    });
    expect(errors[1]?.line).toBeUndefined();
  });

  it("appends a single PLUGIN_CRASHED error with fix-or-remove resolution", () => {
    const outcome: PluginOutcome = {
      kind: "ok",
      spec,
      result: {
        pluginName: "acme-checks",
        pluginVersion: "1.0.0",
        diagnostics: [],
        crash: { message: 'Validator "v" crashed: TypeError' },
      },
    };
    const errors = pluginOutcomeErrors(outcome, ROOT);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("PLUGIN_CRASHED");
    expect(errors[0]?.resolution).toContain("Fix or remove plugin 'acme-checks' from .bp.json");
  });
});
