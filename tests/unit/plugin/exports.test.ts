import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as pluginApi from "../../../src/plugin/index.js";

describe("@agentic/bp/plugin subpath export", () => {
  it("is declared in package.json exports with types and import entries", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
    ) as { exports: Record<string, { types?: string; import?: string }> };
    expect(pkg.exports["./plugin"]).toEqual({
      types: "./dist/plugin/index.d.ts",
      import: "./dist/plugin/index.js",
    });
  });

  it("exposes definePlugin as the only runtime export", () => {
    expect(typeof pluginApi.definePlugin).toBe("function");
    const runtimeExports = Object.keys(pluginApi).filter(
      (key) => typeof (pluginApi as Record<string, unknown>)[key] !== "undefined"
    );
    expect(runtimeExports).toEqual(["definePlugin"]);
  });
});
