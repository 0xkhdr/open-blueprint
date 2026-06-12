import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BackendManifest } from "../../../src/templater/selector.js";
import type {
  LevelOutcome,
  LevelValidator,
  ValidationContext,
  ValidationLevel,
} from "../../../src/validator/contracts.js";
import { createDefaultLevels, ValidationPipeline } from "../../../src/validator/index.js";
import { resolveServices } from "../../../src/validator/default-wiring.js";

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

/** Records when it ran so tests can assert pipeline ordering and gating. */
class RecordingLevel implements LevelValidator {
  readonly skipOnStructuralFailure: boolean;
  constructor(
    readonly name: string,
    private readonly log: string[],
    opts: { skipOnStructuralFailure?: boolean; severity?: "error" | "warning" } = {}
  ) {
    this.skipOnStructuralFailure = opts.skipOnStructuralFailure ?? true;
    this.severity = opts.severity ?? "warning";
  }
  private readonly severity: "error" | "warning";

  enabledFor(requested: ValidationLevel): boolean {
    return requested === "all";
  }

  async runGlobal(ctx: ValidationContext): Promise<LevelOutcome> {
    this.log.push(this.name);
    return {
      errors: [
        {
          file: ctx.projectRoot,
          type: `MOCK_${this.name.toUpperCase().replace(/-/g, "_")}`,
          severity: this.severity,
          message: `mock finding from ${this.name}`,
          resolution: "none",
        },
      ],
    };
  }
}

describe("ValidationPipeline composition", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-pipeline-test-"));
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Project\n\nA minimal anchor.\n");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("registers the six default levels plus backend-rules in execution order", () => {
    const levels = createDefaultLevels(resolveServices());
    expect(levels.map((l) => l.name)).toEqual([
      "structural",
      "semantic",
      "logical",
      "enforcement",
      "drift",
      "governance",
      "backend-rules",
    ]);
  });

  it("runs an appended level-7 without any pipeline edits (OCP extension point)", async () => {
    const log: string[] = [];
    const services = resolveServices();
    const levels = [...createDefaultLevels(services), new RecordingLevel("level-7", log)];
    const pipeline = new ValidationPipeline({ levels, services });

    const result = await pipeline.run({
      level: "all",
      projectRoot: tmpDir,
      manifest: MOCK_MANIFEST,
      noPlugins: true,
    });

    expect(log).toEqual(["level-7"]);
    expect(result.warnings.some((e) => e.type === "MOCK_LEVEL_7")).toBe(true);
  });

  it("executes injected global levels in registry order", async () => {
    const log: string[] = [];
    const levels = [
      new RecordingLevel("first", log),
      new RecordingLevel("second", log),
      new RecordingLevel("third", log),
    ];
    const pipeline = new ValidationPipeline({ levels });

    await pipeline.run({
      level: "all",
      projectRoot: tmpDir,
      manifest: MOCK_MANIFEST,
      noPlugins: true,
    });

    expect(log).toEqual(["first", "second", "third"]);
  });

  it("skips skipOnStructuralFailure levels once the marking level hard-fails", async () => {
    const log: string[] = [];
    const failingStructural: LevelValidator = {
      name: "structural",
      skipOnStructuralFailure: false,
      marksStructuralFailure: true,
      enabledFor: () => true,
      runFileScoped: async (ctx) => [
        {
          file: ctx.filesToValidate[0] ?? ctx.projectRoot,
          type: "MOCK_STRUCTURAL_FAILURE",
          severity: "error",
          message: "mock structural hard failure",
          resolution: "none",
        },
      ],
    };
    const skipped = new RecordingLevel("skipped", log, { skipOnStructuralFailure: true });
    const survivor = new RecordingLevel("survivor", log, { skipOnStructuralFailure: false });
    const pipeline = new ValidationPipeline({ levels: [failingStructural, skipped, survivor] });

    const result = await pipeline.run({
      level: "all",
      projectRoot: tmpDir,
      manifest: MOCK_MANIFEST,
      noPlugins: true,
    });

    expect(log).toEqual(["survivor"]);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.type === "MOCK_STRUCTURAL_FAILURE")).toBe(true);
  });

  it("levels only see context state, and pipeline state resets between runs", async () => {
    let observed: ValidationContext | undefined;
    const probe: LevelValidator = {
      name: "probe",
      skipOnStructuralFailure: false,
      enabledFor: () => true,
      runGlobal: async (ctx) => {
        observed = ctx;
        return { errors: [] };
      },
    };
    const pipeline = new ValidationPipeline({ levels: [probe] });
    const options = {
      level: "all" as const,
      projectRoot: tmpDir,
      manifest: MOCK_MANIFEST,
      noPlugins: true,
    };

    await pipeline.run(options);
    expect(observed).toBeDefined();
    expect(observed?.files.length).toBe(1);
    expect(observed?.structuralFailed).toBe(false);

    // Second run on the same pipeline instance must not leak state
    const second = await pipeline.run(options);
    expect(second.passed).toBe(true);
  });

  it("uses the injected blueprint source for governance (DIP seam)", async () => {
    let parsedWith: string | undefined;
    const services = resolveServices({
      blueprintSource: {
        parse: async (_root: string, backend: string) => {
          parsedWith = backend;
          return {
            version: "2.0",
            metadata: { name: "test", created_at: new Date().toISOString() },
            rules: [],
            skills: [],
            agents: [],
            hooks: [],
            // biome-ignore lint/suspicious/noExplicitAny: minimal IR stub for the seam test
          } as any;
        },
      },
    });
    const pipeline = new ValidationPipeline({ services });

    await pipeline.run({
      level: "governance",
      projectRoot: tmpDir,
      manifest: MOCK_MANIFEST,
      noPlugins: true,
    });

    expect(parsedWith).toBe("claude");
  });
});
