import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdoptCommand } from "../../../src/cli/commands/adopt.js";
import { createEmitCommand } from "../../../src/cli/commands/emit.js";
import { loadManifest } from "../../../src/templater/manifest.js";

function createProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-adopt-emit-"));
  fs.mkdirSync(path.join(dir, ".claude/rules"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".claude/skills"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".claude/rules/my-rule.md"),
    '---\nid: my-rule\nscope: "src/**"\nseverity: hard\naction: Always write tests\n---\n\nBody\n',
    "utf-8"
  );
  fs.writeFileSync(
    path.join(dir, ".bp.json"),
    '{"backend":"claude","backends":["claude"],"primary_backend":"claude"}',
    "utf-8"
  );
  return dir;
}

/** Capture console.log output produced while running `fn`. */
async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.join(" "));
  });
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return lines.join("\n");
}

describe("bp adopt command", () => {
  let dir: string;
  beforeEach(() => {
    dir = createProject();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("constructs with the expected name and options", () => {
    const cmd = createAdoptCommand();
    expect(cmd.name()).toBe("adopt");
    const flags = cmd.options.map((o) => o.flags);
    expect(flags.some((f) => f.includes("--status"))).toBe(true);
    expect(flags.some((f) => f.includes("--wrap"))).toBe(true);
  });

  it("reports untracked files via --status --json", async () => {
    const out = await captureStdout(async () => {
      await createAdoptCommand().parseAsync([dir, "--status", "--json"], { from: "user" });
    });
    const parsed = JSON.parse(out);
    expect(
      parsed.files.find((f: { path: string }) => f.path === ".claude/rules/my-rule.md").state
    ).toBe("untracked");
  });

  it("records untracked files into the manifest", async () => {
    await captureStdout(async () => {
      await createAdoptCommand().parseAsync([dir, "--json"], { from: "user" });
    });
    const manifest = await loadManifest(dir);
    expect(manifest?.files[".claude/rules/my-rule.md"]?.origin).toBe("adopted");
  });

  it("wraps bodies in preserve markers with --wrap", async () => {
    await captureStdout(async () => {
      await createAdoptCommand().parseAsync([dir, "--wrap", "--json"], { from: "user" });
    });
    const content = fs.readFileSync(path.join(dir, ".claude/rules/my-rule.md"), "utf-8");
    expect(content).toContain("<!-- bp:preserve -->");
  });

  it("does not persist changes in --dry-run", async () => {
    await captureStdout(async () => {
      await createAdoptCommand().parseAsync([dir, "--dry-run", "--json"], { from: "user" });
    });
    expect(await loadManifest(dir)).toBeNull();
  });

  it("prints a human-readable status report", async () => {
    const out = await captureStdout(async () => {
      await createAdoptCommand().parseAsync([dir, "--status"], { from: "user" });
    });
    expect(out).toContain("Ownership status");
    expect(out).toContain("untracked");
  });

  it("prints a human-readable adoption summary", async () => {
    const out = await captureStdout(async () => {
      await createAdoptCommand().parseAsync([dir], { from: "user" });
    });
    expect(out).toContain("Adopted");
    expect(out).toContain(".claude/rules/my-rule.md");
  });

  it("reports when there is nothing to adopt", async () => {
    await captureStdout(async () => {
      await createAdoptCommand().parseAsync([dir], { from: "user" });
    });
    const out = await captureStdout(async () => {
      await createAdoptCommand().parseAsync([dir], { from: "user" });
    });
    expect(out).toContain("Nothing to adopt");
  });
});

describe("bp emit command", () => {
  let dir: string;
  beforeEach(() => {
    dir = createProject();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("constructs with the expected name and options", () => {
    const cmd = createEmitCommand();
    expect(cmd.name()).toBe("emit");
    const flags = cmd.options.map((o) => o.flags);
    expect(flags.some((f) => f.includes("--from"))).toBe(true);
    expect(flags.some((f) => f.includes("--input"))).toBe(true);
  });

  it("emits an IR from --input JSON to disk", async () => {
    const irPath = path.join(dir, "ir.json");
    fs.writeFileSync(
      irPath,
      JSON.stringify({
        version: "2.0",
        spatial_anchor: { project_name: "t", surface: "", temporal_anchor: "", conventions: [] },
        personas: [],
        rules: [],
        skills: [
          {
            name: "Deploy",
            description: "Ship it",
            when_to_use: "on release",
            tools_required: ["Bash"],
            procedure: "Run deploy",
          },
        ],
        hooks: [],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "claude",
          target_backend: "claude",
        },
      }),
      "utf-8"
    );
    const out = await captureStdout(async () => {
      await createEmitCommand().parseAsync([dir, "--input", irPath, "--json"], { from: "user" });
    });
    expect(JSON.parse(out).skills).toBe(1);
    expect(fs.existsSync(path.join(dir, ".claude/skills/deploy.md"))).toBe(true);
  });

  it("supports --dry-run without writing", async () => {
    const irPath = path.join(dir, "ir.json");
    fs.writeFileSync(
      irPath,
      JSON.stringify({
        version: "2.0",
        spatial_anchor: { project_name: "t", surface: "", temporal_anchor: "", conventions: [] },
        personas: [],
        rules: [{ id: "r", scope: "**", severity: "soft", action: "do" }],
        skills: [],
        hooks: [],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "claude",
          target_backend: "claude",
        },
      }),
      "utf-8"
    );
    await captureStdout(async () => {
      await createEmitCommand().parseAsync([dir, "--input", irPath, "--dry-run", "--json"], {
        from: "user",
      });
    });
    expect(fs.existsSync(path.join(dir, ".claude/rules/r.md"))).toBe(false);
  });

  it("prints a human-readable emit summary", async () => {
    const irPath = path.join(dir, "ir.json");
    fs.writeFileSync(
      irPath,
      JSON.stringify({
        version: "2.0",
        spatial_anchor: { project_name: "t", surface: "", temporal_anchor: "", conventions: [] },
        personas: [],
        rules: [{ id: "fresh", scope: "**", severity: "soft", action: "do" }],
        skills: [],
        hooks: [],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "claude",
          target_backend: "claude",
        },
      }),
      "utf-8"
    );
    const out = await captureStdout(async () => {
      await createEmitCommand().parseAsync([dir, "--input", irPath], { from: "user" });
    });
    expect(out).toContain("Emitted");
    expect(out).toContain(".claude/rules/fresh.md");
    expect(out).toContain("written");
  });

  it("throws a BpError when the input IR file is missing", async () => {
    await expect(
      createEmitCommand().parseAsync([dir, "--input", path.join(dir, "nope.json"), "--json"], {
        from: "user",
      })
    ).rejects.toThrow();
  });
});
