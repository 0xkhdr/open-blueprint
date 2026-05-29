import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PIAdapter } from "../../../src/translator/adapters/pi.js";

describe("PIAdapter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-pi-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("parse", () => {
    it("returns valid IR with minimal PI.md anchor", async () => {
      fs.writeFileSync(path.join(tmpDir, "PI.md"), "# my-project\n\n- convention one\n");
      const adapter = new PIAdapter();
      const ir = await adapter.parse(tmpDir);

      expect(ir.version).toBe("2.0");
      expect(ir.spatial_anchor.project_name).toBe("my-project");
      expect(ir.spatial_anchor.conventions).toContain("convention one");
      expect(ir.meta.source_backend).toBe("pi");
    });

    it("returns unknown project name when PI.md missing", async () => {
      const adapter = new PIAdapter();
      const ir = await adapter.parse(tmpDir);

      expect(ir.spatial_anchor.project_name).toBe("unknown");
      expect(ir.personas).toHaveLength(0);
      expect(ir.rules).toHaveLength(0);
    });

    it("parses agent files from .pi/agents/", async () => {
      const piDir = path.join(tmpDir, ".pi", "agents");
      fs.mkdirSync(piDir, { recursive: true });
      fs.writeFileSync(
        path.join(piDir, "engineer.md"),
        `---\nname: engineer\nrole: Backend developer\nreasoning_style: methodical\n---\n\n## Constraints\n\n- No direct DB writes\n`
      );

      const adapter = new PIAdapter();
      const ir = await adapter.parse(tmpDir);

      expect(ir.personas).toHaveLength(1);
      expect(ir.personas[0]?.name).toBe("engineer");
      expect(ir.personas[0]?.role).toBe("Backend developer");
      expect(ir.personas[0]?.constraints).toContain("No direct DB writes");
    });

    it("skips malformed agent files without throwing", async () => {
      const piDir = path.join(tmpDir, ".pi", "agents");
      fs.mkdirSync(piDir, { recursive: true });
      fs.writeFileSync(path.join(piDir, "bad.md"), "not valid yaml: [\nbad");

      const adapter = new PIAdapter();
      const ir = await adapter.parse(tmpDir);
      // Should not throw — malformed files skipped
      expect(ir).toBeDefined();
    });
  });

  describe("render", () => {
    it("writes PI.md and agent files from IR", async () => {
      const adapter = new PIAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "test",
          surface: "# test\n",
          temporal_anchor: new Date().toISOString(),
          conventions: [],
        },
        personas: [
          {
            name: "dev",
            role: "developer",
            reasoning_style: "methodical",
            constraints: ["no secrets"],
          },
        ],
        rules: [],
        skills: [],
        hooks: [],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "pi",
          target_backend: "pi",
        },
      };

      const files = await adapter.render(ir, tmpDir);
      expect(files.some((f) => f.endsWith("PI.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "PI.md"))).toBe(true);
    });
  });
});
