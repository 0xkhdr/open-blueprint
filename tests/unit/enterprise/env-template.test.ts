import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectEnvVariables,
  generateEnvTemplate,
  inferDescription,
} from "../../../src/enterprise/env-template.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-env-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(name: string, content: string): void {
  const p = path.join(tmpDir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
}

describe("inferDescription", () => {
  it("returns description for PORT", () => {
    expect(inferDescription("PORT")).toContain("port");
  });

  it("returns description for NODE_ENV", () => {
    expect(inferDescription("NODE_ENV")).toContain("Environment");
  });

  it("returns description for DATABASE_URL", () => {
    expect(inferDescription("DATABASE_URL")).toContain("Database");
  });

  it("returns description for JWT_SECRET", () => {
    expect(inferDescription("JWT_SECRET")).toContain("JWT");
  });

  it("returns fallback for unknown key", () => {
    const desc = inferDescription("SOME_CUSTOM_VAR");
    expect(desc).toContain("SOME_CUSTOM_VAR");
  });
});

describe("detectEnvVariables", () => {
  it("detects process.env.PORT", () => {
    writeFile("src/index.ts", "const port = process.env.PORT;");
    const vars = detectEnvVariables(tmpDir);
    expect(vars.some((v) => v.key === "PORT")).toBe(true);
  });

  it("detects process.env['DATABASE_URL']", () => {
    writeFile("src/db.ts", 'const url = process.env["DATABASE_URL"];');
    const vars = detectEnvVariables(tmpDir);
    expect(vars.some((v) => v.key === "DATABASE_URL")).toBe(true);
  });

  it('detects process.env["KEY"] bracket notation', () => {
    writeFile("src/auth.ts", 'const secret = process.env["JWT_SECRET"];');
    const vars = detectEnvVariables(tmpDir);
    expect(vars.some((v) => v.key === "JWT_SECRET")).toBe(true);
  });

  it("deduplicates vars found in multiple files", () => {
    writeFile("src/a.ts", "const p = process.env.PORT;");
    writeFile("src/b.ts", "const p = process.env.PORT;");
    const vars = detectEnvVariables(tmpDir);
    const portVars = vars.filter((v) => v.key === "PORT");
    expect(portVars.length).toBe(1);
  });

  it("marks var as required when no default is present", () => {
    writeFile("src/index.ts", "const key = process.env.API_KEY;");
    const vars = detectEnvVariables(tmpDir);
    const v = vars.find((v) => v.key === "API_KEY");
    expect(v?.required).toBe(true);
  });

  it("marks var as not required when || default is present", () => {
    writeFile("src/index.ts", "const port = process.env.PORT || '3000';");
    const vars = detectEnvVariables(tmpDir);
    const v = vars.find((v) => v.key === "PORT");
    expect(v?.required).toBe(false);
  });

  it("returns empty array for project with no env vars", () => {
    writeFile("src/index.ts", "const x = 42;");
    const vars = detectEnvVariables(tmpDir);
    expect(vars).toEqual([]);
  });

  it("skips node_modules", () => {
    writeFile("node_modules/pkg/index.js", "const x = process.env.NODE_MODULES_VAR;");
    const vars = detectEnvVariables(tmpDir);
    expect(vars.some((v) => v.key === "NODE_MODULES_VAR")).toBe(false);
  });
});

describe("generateEnvTemplate", () => {
  it("includes header comment", () => {
    writeFile("src/index.ts", "const p = process.env.PORT;");
    const template = generateEnvTemplate(tmpDir);
    expect(template).toContain("Environment Variables Template");
    expect(template).toContain("DO NOT commit");
  });

  it("includes detected variable", () => {
    writeFile("src/index.ts", "const key = process.env.API_KEY;");
    const template = generateEnvTemplate(tmpDir);
    expect(template).toContain("API_KEY");
  });

  it("required vars appear uncommented", () => {
    writeFile("src/index.ts", "const key = process.env.API_KEY;");
    const template = generateEnvTemplate(tmpDir);
    const lines = template.split("\n");
    const keyLine = lines.find((l) => l.startsWith("API_KEY="));
    expect(keyLine).toBeTruthy();
  });

  it("optional vars appear commented out", () => {
    writeFile("src/index.ts", "const port = process.env.PORT || '3000';");
    const template = generateEnvTemplate(tmpDir);
    const lines = template.split("\n");
    const portLine = lines.find((l) => l.includes("PORT="));
    expect(portLine?.startsWith("#")).toBe(true);
  });

  it("returns message when no vars detected", () => {
    writeFile("src/index.ts", "const x = 42;");
    const template = generateEnvTemplate(tmpDir);
    expect(template).toContain("No environment variables");
  });

  it("includes description comment before each var", () => {
    writeFile("src/index.ts", "const p = process.env.PORT;");
    const template = generateEnvTemplate(tmpDir);
    expect(template).toContain("# Server port");
  });
});
