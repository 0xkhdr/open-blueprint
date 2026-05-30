import { describe, expect, it } from "vitest";
import { computeShannonEntropy, scanForSecrets } from "../../../src/security/scan.js";

describe("computeShannonEntropy", () => {
  it("returns 0 for empty string", () => {
    expect(computeShannonEntropy("")).toBe(0);
  });

  it("returns 0 for single repeated character", () => {
    expect(computeShannonEntropy("aaaaaaaaaa")).toBe(0);
  });

  it("returns low entropy for a repeated-char string", () => {
    expect(computeShannonEntropy("aaaaaaaaaaaaaaaaaaaaa")).toBeLessThan(0.1);
  });

  it("returns high entropy for a random-looking string", () => {
    // Base64-like random string with high entropy
    const highEntropy = "xK9mP2nQ7wR4vL6zA3bC8dE5fG1hI0jY";
    expect(computeShannonEntropy(highEntropy)).toBeGreaterThan(4.5);
  });
});

describe("entropy-secret-scanning", () => {
  it("high-entropy random string is flagged when entropyEnabled", () => {
    // String with special chars (not base64) and high entropy
    const content = "token: xK9!mP2$nQ7@wR4#vL6_zA3-bC8*dE5fG";
    const findings = scanForSecrets("file.md", content, { entropyEnabled: true });
    const entropyFindings = findings.filter((f) => f.type === "HIGH_ENTROPY_STRING");
    expect(entropyFindings.length).toBeGreaterThan(0);
    expect(entropyFindings[0]?.severity).toBe("warning");
  });

  it("low-entropy repeated-char string is not flagged", () => {
    const content = "value: aaaaaaaaaaaaaaaaaaaaaa";
    const findings = scanForSecrets("file.md", content, { entropyEnabled: true });
    expect(findings.filter((f) => f.type === "HIGH_ENTROPY_STRING")).toHaveLength(0);
  });

  it("entropy scan disabled by default — no HIGH_ENTROPY_STRING findings", () => {
    const content = "token: xK9mP2nQ7wR4vL6zA3bC8dE5fG1hI0jY";
    const findings = scanForSecrets("file.md", content);
    expect(findings.filter((f) => f.type === "HIGH_ENTROPY_STRING")).toHaveLength(0);
  });

  it("known AWS key regex takes precedence — no duplicate HIGH_ENTROPY_STRING on same line", () => {
    const content = "key: AKIAIOSFODNN7EXAMPLE";
    const findings = scanForSecrets("file.md", content, { entropyEnabled: true });
    const regexFindings = findings.filter((f) => f.type === "SECRET_LEAK_DETECTED");
    const entropyFindings = findings.filter((f) => f.type === "HIGH_ENTROPY_STRING");
    expect(regexFindings.length).toBeGreaterThan(0);
    expect(entropyFindings).toHaveLength(0);
  });

  it("short token under 20 chars is not flagged by entropy", () => {
    const content = "val: xK9mP2nQ7wR4v";
    const findings = scanForSecrets("file.md", content, { entropyEnabled: true });
    expect(findings.filter((f) => f.type === "HIGH_ENTROPY_STRING")).toHaveLength(0);
  });
});
