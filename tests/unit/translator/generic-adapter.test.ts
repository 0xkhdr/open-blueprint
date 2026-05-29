import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GenericAdapter } from "../../../src/translator/adapters/generic.js";

describe("GenericAdapter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-generic-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("parse — missing optional fields", () => {
    it("normalizes persona with no allowed_tools to empty array", async () => {
      const agentsDir = path.join(tmpDir, "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "dev.md"),
        `---\nname: dev\nrole: developer\n---\n\n## Constraints\n\n- test constraint\n`
      );

      const adapter = new GenericAdapter();
      const ir = await adapter.parse(tmpDir);
      expect(ir.personas[0]?.allowed_tools).toEqual([]);
    });

    it("normalizes rule with no rationale or tags", async () => {
      const rulesDir = path.join(tmpDir, "rules");
      fs.mkdirSync(rulesDir, { recursive: true });
      fs.writeFileSync(
        path.join(rulesDir, "no-console.md"),
        `---\nscope: "src/**"\nseverity: hard\naction: No console.log\n---\n`
      );

      const adapter = new GenericAdapter();
      const ir = await adapter.parse(tmpDir);
      expect(ir.rules).toHaveLength(1);
      expect(ir.rules[0]?.rationale).toBeUndefined();
      expect(ir.rules[0]?.tags).toBeUndefined();
    });

    it("normalizes skill with no tools_required to empty array", async () => {
      const skillsDir = path.join(tmpDir, "skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillsDir, "debug.md"),
        `---\nname: debug\ndescription: Debug helper\nwhen_to_use: When debugging\n---\n\nProcedure here.\n`
      );

      const adapter = new GenericAdapter();
      const ir = await adapter.parse(tmpDir);
      expect(ir.skills[0]?.tools_required).toEqual([]);
    });

    it("returns empty personas/rules/skills when no files exist", async () => {
      const adapter = new GenericAdapter();
      const ir = await adapter.parse(tmpDir);
      expect(ir.personas).toEqual([]);
      expect(ir.rules).toEqual([]);
      expect(ir.skills).toEqual([]);
    });

    it("skips malformed files without throwing", async () => {
      const rulesDir = path.join(tmpDir, "rules");
      fs.mkdirSync(rulesDir, { recursive: true });
      fs.writeFileSync(path.join(rulesDir, "bad.md"), "INVALID YAML [[[");

      const adapter = new GenericAdapter();
      const ir = await adapter.parse(tmpDir);
      // Should not throw
      expect(ir).toBeDefined();
    });
  });
});
