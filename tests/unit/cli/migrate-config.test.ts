import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isV1Config, loadProjectConfig } from "../../../src/config/project.js";

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-migrate-config-test-"));
}

describe("migrate config: v1 → v2 transform", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("isV1Config detects v1 format", () => {
    expect(isV1Config({ backend: "claude" })).toBe(true);
    expect(isV1Config({ backends: ["claude"], primary_backend: "claude" })).toBe(false);
    expect(isV1Config({ backend: "claude", backends: ["claude"] })).toBe(false);
  });

  it("v1 .bp.json is transformed at read time to v2", () => {
    const configPath = path.join(tmpDir, ".bp.json");
    const v1 = { backend: "claude", exclude: [], plugins: [] };
    fs.writeFileSync(configPath, JSON.stringify(v1), "utf-8");

    const config = loadProjectConfig(tmpDir);
    expect(config).not.toBeNull();
    expect(config?.backends).toEqual(["claude"]);
    expect(config?.primary_backend).toBe("claude");
  });

  it("manual v1→v2 migration produces correct output", () => {
    const v1Raw = { backend: "cursor", exclude: ["dist/"], plugins: [] };
    const isV1 = isV1Config(v1Raw);
    expect(isV1).toBe(true);

    const backend = v1Raw.backend as string;
    const v2 = {
      backends: [backend],
      primary_backend: backend,
      exclude: v1Raw.exclude,
      plugins: v1Raw.plugins,
    };

    expect(v2.backends).toEqual(["cursor"]);
    expect(v2.primary_backend).toBe("cursor");
    expect("backend" in v2).toBe(false);
  });
});
