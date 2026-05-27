import { describe, it, expect } from "vitest";
import { scanForSecrets } from "../../../src/security/scan.js";

describe("Post-generation Secret Scanner", () => {
  it("detects private key headers", () => {
    const content = `
# AWS Config
Private key:
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA01v6jJqN...
-----END RSA PRIVATE KEY-----
`;
    const errors = scanForSecrets("spatial_anchor.md", content);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("SECRET_LEAK_DETECTED");
    expect(errors[0]?.message).toContain("Private Key Header");
  });

  it("detects JWT tokens", () => {
    const content = "auth: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const errors = scanForSecrets("config.md", content);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("JSON Web Token");
  });

  it("detects AWS Access Keys", () => {
    const content = "AWS_KEY = AKIAIOSFODNN7EXAMPLE";
    const errors = scanForSecrets("secrets.md", content);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("AWS Access Key");
  });

  it("passes files with no secrets", () => {
    const content = "# Readme\nNo secrets here, just standard configurations.\n";
    const errors = scanForSecrets("readme.md", content);
    expect(errors).toHaveLength(0);
  });
});
