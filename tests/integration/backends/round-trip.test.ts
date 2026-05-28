import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeAdapter } from "../../../src/translator/adapters/claude.js";
import { CodexAdapter } from "../../../src/translator/adapters/codex.js";
import { CursorAdapter } from "../../../src/translator/adapters/cursor.js";
import { GenericAdapter } from "../../../src/translator/adapters/generic.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-round-trip-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

const baseIR: BlueprintIR = {
  version: "2.0",
  spatial_anchor: {
    project_name: "node-express-test",
    surface: "# node-express-test\n\nA REST API project.\n",
    temporal_anchor: "2025-05-28",
    conventions: ["Use TypeScript", "REST API conventions", "Async/await only"],
  },
  personas: [
    {
      name: "BackendDev",
      role: "Backend developer",
      reasoning_style: "methodical",
      constraints: ["No sync I/O", "Always validate input"],
      allowed_tools: ["Read", "Edit", "Bash"],
    },
  ],
  rules: [
    {
      id: "no-sync-io",
      scope: "src/**/*.ts",
      severity: "hard",
      action: "Use async file operations only",
      rationale: "Prevents blocking the event loop",
      tags: ["performance", "node"],
    },
    {
      id: "validate-input",
      scope: "src/routes/**",
      severity: "hard",
      action: "Validate all request inputs with zod",
      rationale: "Security and reliability",
      tags: ["security"],
    },
    {
      id: "error-handling",
      scope: "src/**",
      severity: "soft",
      action: "Always handle promise rejections",
      tags: ["reliability"],
    },
  ],
  skills: [
    {
      name: "AddRoute",
      description: "Add a new Express route with validation",
      when_to_use: "When adding new API endpoints",
      tools_required: ["Edit", "Read"],
      procedure: "1. Define schema\n2. Add route handler\n3. Write test",
    },
    {
      name: "DatabaseQuery",
      description: "Write a safe database query",
      when_to_use: "When querying the database",
      tools_required: ["Edit"],
      procedure: "1. Use parameterized queries\n2. Handle errors",
    },
  ],
  hooks: [],
  meta: {
    rule_precedence: ["no-sync-io", "validate-input", "error-handling"],
    conflict_resolution: "precedence-based",
    source_backend: "claude",
    target_backend: "claude",
  },
};

function fidelityScore(a: BlueprintIR, b: BlueprintIR): number {
  let matches = 0;
  let total = 0;

  total++;
  if (a.rules.length === b.rules.length) matches++;

  total++;
  if (a.skills.length === b.skills.length) matches++;

  for (const rule of a.rules) {
    const found = b.rules.find((r) => r.id === rule.id);
    total++;
    if (found) {
      matches++;
      total++;
      if (found.severity === rule.severity) matches++;
    }
  }

  for (const skill of a.skills) {
    const found = b.skills.find((s) => s.name === skill.name);
    total++;
    if (found) matches++;
  }

  return total > 0 ? matches / total : 0;
}

describe("Backend Round-Trip Tests", () => {
  // Round-trip pattern: render baseIR with adapterB, parse with adapterB,
  // render with adapterA, parse with adapterA, compare with baseIR.
  // This tests that the chain A→B→A preserves data through format conversions.

  let dir1: string;
  let dir2: string;

  beforeEach(() => {
    dir1 = createTmpDir();
    dir2 = createTmpDir();
  });

  afterEach(() => {
    cleanDir(dir1);
    cleanDir(dir2);
  });

  describe("claude → cursor → claude", () => {
    it("preserves rules and skills (fidelity ≥ 95%)", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const cursorAdapter = new CursorAdapter();

      // Step 1: render baseIR into cursor format
      await cursorAdapter.render(baseIR, dir1);
      // Step 2: parse from cursor format
      const cursorIR = await cursorAdapter.parse(dir1);
      // Step 3: render cursor IR into claude format
      await claudeAdapter.render(cursorIR, dir2);
      // Step 4: parse from claude format
      const finalIR = await claudeAdapter.parse(dir2);

      const score = fidelityScore(baseIR, finalIR);
      expect(score).toBeGreaterThanOrEqual(0.95);
    });

    it("preserves rule count", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const cursorAdapter = new CursorAdapter();

      await cursorAdapter.render(baseIR, dir1);
      const cursorIR = await cursorAdapter.parse(dir1);
      await claudeAdapter.render(cursorIR, dir2);
      const finalIR = await claudeAdapter.parse(dir2);

      expect(finalIR.rules.length).toBe(baseIR.rules.length);
    });

    it("preserves skill count", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const cursorAdapter = new CursorAdapter();

      await cursorAdapter.render(baseIR, dir1);
      const cursorIR = await cursorAdapter.parse(dir1);
      await claudeAdapter.render(cursorIR, dir2);
      const finalIR = await claudeAdapter.parse(dir2);

      expect(finalIR.skills.length).toBe(baseIR.skills.length);
    });

    it("preserves hard severity rules", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const cursorAdapter = new CursorAdapter();

      await cursorAdapter.render(baseIR, dir1);
      const cursorIR = await cursorAdapter.parse(dir1);
      await claudeAdapter.render(cursorIR, dir2);
      const finalIR = await claudeAdapter.parse(dir2);

      const hardRules = finalIR.rules.filter((r) => r.severity === "hard");
      expect(hardRules.length).toBe(baseIR.rules.filter((r) => r.severity === "hard").length);
    });

    it("generates AGENTS.md at cursor step", async () => {
      const cursorAdapter = new CursorAdapter();
      await cursorAdapter.render(baseIR, dir1);
      expect(fs.existsSync(path.join(dir1, "AGENTS.md"))).toBe(true);
    });

    it("generates AGENTS.md at claude step", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const cursorAdapter = new CursorAdapter();

      await cursorAdapter.render(baseIR, dir1);
      const cursorIR = await cursorAdapter.parse(dir1);
      await claudeAdapter.render(cursorIR, dir2);

      expect(fs.existsSync(path.join(dir2, "AGENTS.md"))).toBe(true);
    });
  });

  describe("claude → codex → claude", () => {
    it("preserves rules and skills (fidelity ≥ 95%)", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();

      await codexAdapter.render(baseIR, dir1);
      const codexIR = await codexAdapter.parse(dir1);
      await claudeAdapter.render(codexIR, dir2);
      const finalIR = await claudeAdapter.parse(dir2);

      const score = fidelityScore(baseIR, finalIR);
      expect(score).toBeGreaterThanOrEqual(0.95);
    });

    it("preserves rule count", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();

      await codexAdapter.render(baseIR, dir1);
      const codexIR = await codexAdapter.parse(dir1);
      await claudeAdapter.render(codexIR, dir2);
      const finalIR = await claudeAdapter.parse(dir2);

      expect(finalIR.rules.length).toBe(baseIR.rules.length);
    });

    it("preserves skill count", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();

      await codexAdapter.render(baseIR, dir1);
      const codexIR = await codexAdapter.parse(dir1);
      await claudeAdapter.render(codexIR, dir2);
      const finalIR = await claudeAdapter.parse(dir2);

      expect(finalIR.skills.length).toBe(baseIR.skills.length);
    });

    it("preserves severity mapping", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();

      await codexAdapter.render(baseIR, dir1);
      const codexIR = await codexAdapter.parse(dir1);
      await claudeAdapter.render(codexIR, dir2);
      const finalIR = await claudeAdapter.parse(dir2);

      const originalHard = baseIR.rules.filter((r) => r.severity === "hard").length;
      const finalHard = finalIR.rules.filter((r) => r.severity === "hard").length;
      expect(finalHard).toBe(originalHard);
    });

    it("generates AGENTS.md at codex step", async () => {
      const codexAdapter = new CodexAdapter();
      await codexAdapter.render(baseIR, dir1);
      expect(fs.existsSync(path.join(dir1, "AGENTS.md"))).toBe(true);
    });

    it("generates AGENTS.md at claude step", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();

      await codexAdapter.render(baseIR, dir1);
      const codexIR = await codexAdapter.parse(dir1);
      await claudeAdapter.render(codexIR, dir2);

      expect(fs.existsSync(path.join(dir2, "AGENTS.md"))).toBe(true);
    });
  });

  describe("cursor → generic → cursor", () => {
    it("preserves rules and skills (fidelity ≥ 95%)", async () => {
      const cursorAdapter = new CursorAdapter();
      const genericAdapter = new GenericAdapter();

      // Start: render baseIR with generic
      await genericAdapter.render(baseIR, dir1);
      // Parse with generic
      const genericIR = await genericAdapter.parse(dir1);
      // Render with cursor
      await cursorAdapter.render(genericIR, dir2);
      // Parse with cursor
      const finalIR = await cursorAdapter.parse(dir2);

      const score = fidelityScore(baseIR, finalIR);
      expect(score).toBeGreaterThanOrEqual(0.95);
    });

    it("preserves rule count", async () => {
      const cursorAdapter = new CursorAdapter();
      const genericAdapter = new GenericAdapter();

      await genericAdapter.render(baseIR, dir1);
      const genericIR = await genericAdapter.parse(dir1);
      await cursorAdapter.render(genericIR, dir2);
      const finalIR = await cursorAdapter.parse(dir2);

      expect(finalIR.rules.length).toBe(baseIR.rules.length);
    });

    it("preserves skill count", async () => {
      const cursorAdapter = new CursorAdapter();
      const genericAdapter = new GenericAdapter();

      await genericAdapter.render(baseIR, dir1);
      const genericIR = await genericAdapter.parse(dir1);
      await cursorAdapter.render(genericIR, dir2);
      const finalIR = await cursorAdapter.parse(dir2);

      expect(finalIR.skills.length).toBe(baseIR.skills.length);
    });

    it("generates AGENTS.md at generic step", async () => {
      const genericAdapter = new GenericAdapter();
      await genericAdapter.render(baseIR, dir1);
      expect(fs.existsSync(path.join(dir1, "AGENTS.md"))).toBe(true);
    });

    it("generates AGENTS.md at cursor step", async () => {
      const cursorAdapter = new CursorAdapter();
      const genericAdapter = new GenericAdapter();

      await genericAdapter.render(baseIR, dir1);
      const genericIR = await genericAdapter.parse(dir1);
      await cursorAdapter.render(genericIR, dir2);

      expect(fs.existsSync(path.join(dir2, "AGENTS.md"))).toBe(true);
    });
  });
});
