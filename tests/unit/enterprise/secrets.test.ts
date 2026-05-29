import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SECRET_PATTERNS, collectTextFiles, scanForSecrets } from "../../../src/enterprise/secrets.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-secrets-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(name: string, content: string): string {
  const p = path.join(tmpDir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
  return p;
}

describe("SECRET_PATTERNS", () => {
  it("has 8 patterns", () => {
    expect(SECRET_PATTERNS.length).toBe(8);
  });

  it("all patterns have required fields", () => {
    for (const p of SECRET_PATTERNS) {
      expect(p.name).toBeTruthy();
      expect(p.pattern).toBeInstanceOf(RegExp);
      expect(["critical", "high", "medium"]).toContain(p.severity);
      expect(p.example).toBeTruthy();
    }
  });
});

describe("scanForSecrets", () => {
  it("detects AWS Access Key ID", () => {
    writeFile("config.ts", 'const key = "AKIAIOSFODNN7EXAMPLE123456";');
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "AWS Access Key ID")).toBe(true);
  });

  it("detects GitHub PAT (ghp_)", () => {
    writeFile("config.ts", 'const token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";');
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "GitHub Personal Access Token")).toBe(true);
  });

  it("detects GitHub PAT (gho_)", () => {
    writeFile("config.ts", 'const token = "gho_abcdefghijklmnopqrstuvwxyz1234567890";');
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "GitHub Personal Access Token")).toBe(true);
  });

  it("detects JWT token", () => {
    writeFile("auth.ts", 'const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";');
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "JWT Token")).toBe(true);
  });

  it("detects private key header", () => {
    writeFile("key.pem", "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----");
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "Private Key")).toBe(true);
  });

  it("detects EC private key", () => {
    writeFile("key.pem", "-----BEGIN EC PRIVATE KEY-----\nMHQCAQEEI...\n-----END EC PRIVATE KEY-----");
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "Private Key")).toBe(true);
  });

  it("detects Slack token", () => {
    // split to avoid triggering GitHub push protection on test source
    const tok = "xoxb-" + "1234567890123-" + "1234567890123-abcdefghijklmnopqrstuvwx";
    writeFile("slack.ts", `const token = "${tok}";`);
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "Slack Token")).toBe(true);
  });

  it("detects database connection string (postgres)", () => {
    writeFile("db.ts", 'const url = "postgres://user:password@localhost:5432/mydb";');
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "Database Connection String")).toBe(true);
  });

  it("detects database connection string (mongodb)", () => {
    writeFile("db.ts", 'const url = "mongodb://user:pass@host:27017/db";');
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "Database Connection String")).toBe(true);
  });

  it("detects database connection string (redis)", () => {
    writeFile("cache.ts", 'const url = "redis://user:pass@redis:6379";');
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "Database Connection String")).toBe(true);
  });

  it("detects generic API key", () => {
    writeFile("config.ts", "const api_key = 'abcdefghijklmnopqrst12345678';");
    const findings = scanForSecrets(tmpDir);
    expect(findings.some((f) => f.pattern === "Generic API Key")).toBe(true);
  });

  it("returns correct file path relative to root", () => {
    writeFile("src/config.ts", 'const key = "AKIAIOSFODNN7EXAMPLE123456";');
    const findings = scanForSecrets(tmpDir);
    expect(findings[0].file).toBe("src/config.ts");
  });

  it("returns correct line number", () => {
    writeFile("config.ts", "line1\nline2\nconst key = 'AKIAIOSFODNN7EXAMPLE123456';\nline4");
    const findings = scanForSecrets(tmpDir);
    const awsFinding = findings.find((f) => f.pattern === "AWS Access Key ID");
    expect(awsFinding?.line).toBe(3);
  });

  it("returns correct severity for AWS key", () => {
    writeFile("config.ts", 'const key = "AKIAIOSFODNN7EXAMPLE123456";');
    const findings = scanForSecrets(tmpDir);
    const f = findings.find((f) => f.pattern === "AWS Access Key ID");
    expect(f?.severity).toBe("critical");
  });

  it("returns empty array for clean project", () => {
    writeFile("config.ts", 'const PORT = process.env.PORT || 3000;');
    const findings = scanForSecrets(tmpDir);
    expect(findings).toEqual([]);
  });

  it("skips node_modules directory", () => {
    writeFile("node_modules/some-pkg/config.ts", 'const key = "AKIAIOSFODNN7EXAMPLE123456";');
    const findings = scanForSecrets(tmpDir);
    expect(findings.length).toBe(0);
  });

  it("skips .git directory", () => {
    writeFile(".git/config", 'token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890"');
    const findings = scanForSecrets(tmpDir);
    expect(findings.length).toBe(0);
  });

  it("handles multiple secrets in one file", () => {
    writeFile("config.ts", [
      'const key = "AKIAIOSFODNN7EXAMPLE123456";',
      'const token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";',
    ].join("\n"));
    const findings = scanForSecrets(tmpDir);
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });

  it("handles unreadable file gracefully", () => {
    writeFile("config.ts", "clean content");
    expect(() => scanForSecrets(tmpDir)).not.toThrow();
  });
});

describe("collectTextFiles", () => {
  it("collects .ts files", () => {
    writeFile("src/index.ts", "export {}");
    const files = collectTextFiles(tmpDir);
    expect(files.some((f) => f.endsWith("index.ts"))).toBe(true);
  });

  it("collects .md files", () => {
    writeFile("README.md", "# readme");
    const files = collectTextFiles(tmpDir);
    expect(files.some((f) => f.endsWith("README.md"))).toBe(true);
  });

  it("excludes node_modules", () => {
    writeFile("node_modules/pkg/index.ts", "export {}");
    const files = collectTextFiles(tmpDir);
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
  });

  it("excludes dist", () => {
    writeFile("dist/index.js", "export {}");
    const files = collectTextFiles(tmpDir);
    expect(files.some((f) => f.includes("/dist/"))).toBe(false);
  });

  it("returns empty array for empty directory", () => {
    const files = collectTextFiles(tmpDir);
    expect(files).toEqual([]);
  });
});
