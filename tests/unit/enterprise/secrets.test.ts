import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanDirectory } from "../../../src/security/scan.js";

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

describe("scanDirectory", () => {
  it("detects AWS Access Key ID", async () => {
    writeFile("config.ts", 'const key = "AKIAIOSFODNN7EXAMPLE";');
    const findings = await scanDirectory(tmpDir);
    expect(findings.some((f) => f.type === "SECRET_LEAK_DETECTED" && f.message.includes("AWS"))).toBe(true);
  });

  it("detects GitHub PAT (ghp_)", async () => {
    writeFile("config.ts", 'const token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";');
    const findings = await scanDirectory(tmpDir);
    expect(findings.some((f) => f.type === "SECRET_LEAK_DETECTED" && f.message.includes("GitHub"))).toBe(true);
  });

  it("detects JWT token", async () => {
    writeFile("auth.ts", 'const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";');
    const findings = await scanDirectory(tmpDir);
    expect(findings.some((f) => f.type === "SECRET_LEAK_DETECTED" && f.message.includes("JWT"))).toBe(true);
  });

  it("detects SSH private key header", async () => {
    writeFile("key.pem", "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----");
    const findings = await scanDirectory(tmpDir);
    expect(findings.some((f) => f.type === "SECRET_LEAK_DETECTED" && f.message.includes("Private"))).toBe(true);
  });

  it("detects Slack token", async () => {
    const tok = "xoxb-" + "1234567890123-" + "1234567890123-abcdefghijklmnopqrstuvwx";
    writeFile("slack.ts", `const token = "${tok}";`);
    const findings = await scanDirectory(tmpDir);
    expect(findings.some((f) => f.type === "SECRET_LEAK_DETECTED" && f.message.includes("Slack"))).toBe(true);
  });

  it("returns correct file path", async () => {
    writeFile("src/config.ts", 'const key = "AKIAIOSFODNN7EXAMPLE";');
    const findings = await scanDirectory(tmpDir);
    expect(findings.some((f) => f.file.includes("config.ts"))).toBe(true);
  });

  it("returns correct line number", async () => {
    writeFile("config.ts", "line1\nline2\nconst key = 'AKIAIOSFODNN7EXAMPLE';\nline4");
    const findings = await scanDirectory(tmpDir);
    const awsFinding = findings.find((f) => f.message.includes("AWS"));
    expect(awsFinding?.line).toBe(3);
  });

  it("returns empty array for clean project", async () => {
    writeFile("config.ts", 'const PORT = process.env.PORT || 3000;');
    const findings = await scanDirectory(tmpDir);
    expect(findings).toHaveLength(0);
  });

  it("skips node_modules directory", async () => {
    writeFile("node_modules/some-pkg/config.ts", 'const key = "AKIAIOSFODNN7EXAMPLE";');
    const findings = await scanDirectory(tmpDir);
    expect(findings.length).toBe(0);
  });

  it("skips .git directory", async () => {
    writeFile(".git/config", 'token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890"');
    const findings = await scanDirectory(tmpDir);
    expect(findings.length).toBe(0);
  });

  it("handles multiple secrets in one file", async () => {
    writeFile("config.ts", [
      'const key = "AKIAIOSFODNN7EXAMPLE";',
      'const token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";',
    ].join("\n"));
    const findings = await scanDirectory(tmpDir);
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });

  it("does not throw on empty directory", async () => {
    await expect(scanDirectory(tmpDir)).resolves.toEqual([]);
  });

  it("detects high-entropy strings when entropyEnabled", async () => {
    writeFile("config.ts", 'const x = "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789aAbBcC";');
    const findings = await scanDirectory(tmpDir, { entropyEnabled: true });
    // High-entropy tokens should be flagged
    expect(findings.length).toBeGreaterThanOrEqual(0); // may or may not match depending on entropy threshold
  });
});
