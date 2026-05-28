import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { validateStructural, validateStructuralBatch } from "../../../src/validator/structural.js";
import type { BackendManifest } from "../../../src/templater/selector.js";

const MOCK_MANIFEST: BackendManifest = {
  backend: "claude",
  version: "2026.1",
  supported_features: {
    anchors: true,
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
  },
  file_patterns: {
    anchor: ["CLAUDE.md"],
    rules: ".claude/rules/*.md",
    skills: ".claude/skills/*.md",
    agents: ".claude/agents/*.md",
    hooks: ".claude/hooks/*",
  },
  max_file_sizes: {
    anchor: 5000,
    rules: 10000,
    skills: 15000,
    agents: 8000,
  },
  frontmatter_schema: {
    rules: {
      required: ["scope", "severity"],
      optional: ["action", "rationale", "tags"],
      severity_values: ["hard", "soft", "info"],
    },
    skills: {
      required: ["name", "description"],
      optional: ["tools_required", "when_to_use"],
    },
    agents: {
      required: ["name"],
      optional: ["role", "allowed_tools"],
    },
  },
};

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-validator-test-"));
}

function writeFile(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("validateStructural", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports FILE_NOT_FOUND for missing file", () => {
    const errors = validateStructural(path.join(tmpDir, "missing.md"), MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "FILE_NOT_FOUND")).toBe(true);
  });

  it("passes valid rule file with all required fields", () => {
    const filePath = writeFile(
      tmpDir,
      ".claude/rules/01-test.md",
      `---
scope: "**/*"
severity: hard
action: Do the thing
---

# Rule body content
`
    );
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    const errorOnly = errors.filter((e) => e.severity === "error");
    expect(errorOnly).toHaveLength(0);
  });

  it("detects FRONTMATTER_PARSE_ERROR for malformed YAML", () => {
    const filePath = writeFile(
      tmpDir,
      ".claude/rules/01-malformed.md",
      `---
scope: [unclosed bracket
---
# Body
`
    );
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "FRONTMATTER_PARSE_ERROR")).toBe(true);
  });

  it("detects MISSING_REQUIRED_FIELD for rules missing scope", () => {
    const filePath = writeFile(
      tmpDir,
      ".claude/rules/01-bad.md",
      `---
severity: hard
---

# Body
`
    );
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "MISSING_REQUIRED_FIELD" && e.message.includes("scope"))).toBe(true);
  });

  it("detects MISSING_REQUIRED_FIELD for rules missing severity", () => {
    const filePath = writeFile(
      tmpDir,
      ".claude/rules/01-bad.md",
      `---
scope: "src/**/*"
---

# Body
`
    );
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "MISSING_REQUIRED_FIELD" && e.message.includes("severity"))).toBe(true);
  });

  it("detects INVALID_SEVERITY for bad severity value", () => {
    const filePath = writeFile(
      tmpDir,
      ".claude/rules/01-bad.md",
      `---
scope: "src/**/*"
severity: critical
---

# Body
`
    );
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "INVALID_SEVERITY")).toBe(true);
  });

  it("detects UNCLOSED_CODE_FENCE", () => {
    const filePath = writeFile(
      tmpDir,
      ".claude/rules/01-fence.md",
      `---
scope: "**/*"
severity: soft
---

\`\`\`typescript
const x = 1;
// no closing fence
`
    );
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "UNCLOSED_CODE_FENCE")).toBe(true);
  });

  it("detects BOM_DETECTED", () => {
    const filePath = path.join(tmpDir, ".claude/rules/bom.md");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // Write file with UTF-8 BOM
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const content = Buffer.from("---\nscope: '**/*'\nseverity: soft\n---\n# test");
    fs.writeFileSync(filePath, Buffer.concat([bom, content]));
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "BOM_DETECTED")).toBe(true);
  });

  it("detects FILE_TOO_LARGE", () => {
    const largeContent = "---\nscope: \"**/*\"\nseverity: soft\n---\n" + "x".repeat(11000);
    const filePath = writeFile(tmpDir, ".claude/rules/large.md", largeContent);
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "FILE_TOO_LARGE")).toBe(true);
  });

  it("all errors include resolution path", () => {
    const filePath = writeFile(
      tmpDir,
      ".claude/rules/01-bad.md",
      "---\nseverity: hard\n---\n# body"
    );
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    for (const err of errors) {
      expect(err.resolution).toBeTruthy();
      expect(err.resolution.length).toBeGreaterThan(0);
    }
  });

  it("detects HEADING_HIERARCHY when a heading level is skipped", () => {
    const filePath = writeFile(
      tmpDir,
      ".claude/rules/01-headings.md",
      `---
scope: "**/*"
severity: soft
---
# Heading level 1
### Heading level 3 (skipped level 2)
`
    );
    const errors = validateStructural(filePath, MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "HEADING_HIERARCHY")).toBe(true);
  });

  it("handles generic fallback paths correctly for rules, skills, and agents", () => {
    const fileRule = writeFile(tmpDir, "generic/rules/my-rule.md", "---\nscope: '**'\nseverity: soft\n---\n# Rule");
    const fileSkill = writeFile(tmpDir, "generic/skills/my-skill.md", "---\nname: skill\ndescription: desc\n---\n# Skill");
    const fileAgent = writeFile(tmpDir, "generic/agents/my-agent.md", "---\nname: agent\n---\n# Agent");

    expect(validateStructural(fileRule, MOCK_MANIFEST)).toHaveLength(0);
    expect(validateStructural(fileSkill, MOCK_MANIFEST)).toHaveLength(0);
    expect(validateStructural(fileAgent, MOCK_MANIFEST)).toHaveLength(0);
  });
});

describe("validateStructuralBatch", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("collects errors from multiple files", () => {
    const f1 = writeFile(tmpDir, ".claude/rules/01.md", "---\nseverity: hard\n---\n# body");
    const f2 = writeFile(tmpDir, ".claude/rules/02.md", "---\nscope: '**'\n---\n# body");
    const errors = validateStructuralBatch([f1, f2], MOCK_MANIFEST);
    const files = new Set(errors.map((e) => e.file));
    expect(files.size).toBe(2);
  });

  it("continues validating after first file error", () => {
    const missing = path.join(tmpDir, "nonexistent.md");
    const valid = writeFile(
      tmpDir,
      ".claude/rules/valid.md",
      "---\nscope: '**/*'\nseverity: soft\n---\n# body"
    );
    const errors = validateStructuralBatch([missing, valid], MOCK_MANIFEST);
    expect(errors.some((e) => e.type === "FILE_NOT_FOUND")).toBe(true);
  });
});
