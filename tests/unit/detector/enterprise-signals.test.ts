import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectEnterpriseSignals } from "../../../src/detector/enterprise-signals.js";
import { enrichFingerprint } from "../../../src/detector/index.js";
import type { Fingerprint } from "../../../src/detector/fingerprint.js";
import { detectSecurity } from "../../../src/detector/security.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-test-"));
}

function writeFile(dir: string, filePath: string, content = ""): void {
  const full = path.join(dir, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

const baseFingerprint = (root: string): Fingerprint => ({
  version: "1.0",
  detected_at: new Date().toISOString(),
  project: { name: "test", root, type: "application", git_workflow: "trunk-based" },
  languages: [{ name: "typescript", confidence: 1, primary: true }],
  frameworks: [],
  entry_points: [],
  tooling: { package_manager: "npm" },
  directory_topology: { src_dirs: ["src"], test_dirs: [], config_dirs: [], package_dirs: [] },
  security_signals: { has_auth: false, has_external_apis: false, has_secrets_manager: false, has_docker: false },
});

describe("detectEnterpriseSignals", () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanDir(tmpDir); });

  describe("has_rbac_config", () => {
    it("detects auth0.config file", () => {
      writeFile(tmpDir, "auth0.config", "{}");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_rbac_config).toBe(true);
    });

    it("detects keycloak.json file", () => {
      writeFile(tmpDir, "keycloak.json", "{}");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_rbac_config).toBe(true);
    });

    it("false when no RBAC signals", () => {
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_rbac_config).toBe(false);
    });

    it("detects rbac in nested filename", () => {
      writeFile(tmpDir, "config/rbac.yaml", "roles: []");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_rbac_config).toBe(true);
    });
  });

  describe("has_compliance_docs", () => {
    it("detects GDPR.md", () => {
      writeFile(tmpDir, "GDPR.md", "# GDPR Policy");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_compliance_docs).toBe(true);
    });

    it("detects HIPAA.md", () => {
      writeFile(tmpDir, "HIPAA.md", "# HIPAA Policy");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_compliance_docs).toBe(true);
    });

    it("detects COMPLIANCE.md", () => {
      writeFile(tmpDir, "COMPLIANCE.md", "# Compliance");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_compliance_docs).toBe(true);
    });

    it("detects SOC2.md", () => {
      writeFile(tmpDir, "SOC2.md", "# SOC2");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_compliance_docs).toBe(true);
    });

    it("false when no compliance docs", () => {
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_compliance_docs).toBe(false);
    });
  });

  describe("has_audit_logging", () => {
    it("detects pino in package.json dependencies", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({ dependencies: { pino: "^8.0.0" } }));
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_audit_logging).toBe(true);
    });

    it("detects winston in devDependencies", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({ devDependencies: { winston: "^3.0.0" } }));
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_audit_logging).toBe(true);
    });

    it("detects morgan in dependencies", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({ dependencies: { morgan: "^1.0.0" } }));
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_audit_logging).toBe(true);
    });

    it("detects cloudwatch.json config file", () => {
      writeFile(tmpDir, "cloudwatch.json", "{}");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_audit_logging).toBe(true);
    });

    it("false when no audit logging signals", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({ dependencies: { express: "^4.0.0" } }));
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_audit_logging).toBe(false);
    });
  });

  describe("has_dlp_scanner", () => {
    it("detects gitleaks in .pre-commit-config.yaml", () => {
      writeFile(tmpDir, ".pre-commit-config.yaml", "repos:\n  - hooks:\n    - id: gitleaks\n");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_dlp_scanner).toBe(true);
    });

    it("detects detect-secrets in .pre-commit-config.yaml", () => {
      writeFile(tmpDir, ".pre-commit-config.yaml", "repos:\n  - hooks:\n    - id: detect-secrets\n");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_dlp_scanner).toBe(true);
    });

    it("detects trufflehog in .pre-commit-config.yaml", () => {
      writeFile(tmpDir, ".pre-commit-config.yaml", "repos:\n  - hooks:\n    - id: trufflehog\n");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_dlp_scanner).toBe(true);
    });

    it("false when .pre-commit-config.yaml missing", () => {
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_dlp_scanner).toBe(false);
    });

    it("false when .pre-commit-config.yaml has no DLP tools", () => {
      writeFile(tmpDir, ".pre-commit-config.yaml", "repos:\n  - hooks:\n    - id: prettier\n");
      const signals = detectEnterpriseSignals(tmpDir);
      expect(signals.has_dlp_scanner).toBe(false);
    });
  });

  describe("enrichFingerprint integration", () => {
    it("populates enterprise_signals on enhanced fingerprint", () => {
      const fp = baseFingerprint(tmpDir);
      const enhanced = enrichFingerprint(fp);
      expect(enhanced.enterprise_signals).toBeDefined();
      expect(typeof enhanced.enterprise_signals.has_rbac_config).toBe("boolean");
      expect(typeof enhanced.enterprise_signals.has_compliance_docs).toBe("boolean");
      expect(typeof enhanced.enterprise_signals.has_audit_logging).toBe("boolean");
      expect(typeof enhanced.enterprise_signals.has_dlp_scanner).toBe("boolean");
    });

    it("detects pino via enrichFingerprint", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({ dependencies: { pino: "^8.0.0" } }));
      const fp = baseFingerprint(tmpDir);
      const enhanced = enrichFingerprint(fp);
      expect(enhanced.enterprise_signals.has_audit_logging).toBe(true);
    });

    it("detects compliance doc via enrichFingerprint", () => {
      writeFile(tmpDir, "GDPR.md", "# GDPR");
      const fp = baseFingerprint(tmpDir);
      const enhanced = enrichFingerprint(fp);
      expect(enhanced.enterprise_signals.has_compliance_docs).toBe(true);
    });
  });
});

describe("Extended risk signals", () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanDir(tmpDir); });

  it("has_data_sensitive raises risk score", () => {
    writeFile(tmpDir, "package.json", JSON.stringify({ dependencies: { bcrypt: "^5.0.0" } }));
    const fp = baseFingerprint(tmpDir);
    // Re-run detect to get the updated security signals
    const signals = detectSecurity(tmpDir);
    expect(signals.has_data_sensitive).toBe(true);
  });

  it("has_financial_data detects stripe", () => {
    writeFile(tmpDir, "package.json", JSON.stringify({ dependencies: { stripe: "^12.0.0" } }));
    const signals = detectSecurity(tmpDir);
    expect(signals.has_financial_data).toBe(true);
  });

  it("has_financial_data detects paypal", () => {
    writeFile(tmpDir, "package.json", JSON.stringify({ dependencies: { paypal: "^1.0.0" } }));
    const signals = detectSecurity(tmpDir);
    expect(signals.has_financial_data).toBe(true);
  });

  it("has_pii detects GDPR.md", () => {
    writeFile(tmpDir, "GDPR.md", "# GDPR Policy");
    const signals = detectSecurity(tmpDir);
    expect(signals.has_pii).toBe(true);
  });

  it("has_pii detects HIPAA.md", () => {
    writeFile(tmpDir, "HIPAA.md", "# HIPAA Policy");
    const signals = detectSecurity(tmpDir);
    expect(signals.has_pii).toBe(true);
  });

  it("has_encryption detects TLS config", () => {
    writeFile(tmpDir, "ssl.conf", "ssl_certificate /etc/ssl/certs/cert.pem;");
    const signals = detectSecurity(tmpDir);
    expect(signals.has_encryption).toBe(true);
  });

  it("has_encryption detects tls.createServer in source", () => {
    writeFile(tmpDir, "src/server.ts", "const server = tls.createServer(options, handleConn);");
    const signals = detectSecurity(tmpDir);
    expect(signals.has_encryption).toBe(true);
  });

  it("risk tier elevated by financial data signal", () => {
    const fp = baseFingerprint(tmpDir);
    const fpWithFinancial: Fingerprint = {
      ...fp,
      security_signals: {
        ...fp.security_signals,
        has_financial_data: true,
        has_external_apis: true,
      },
    };
    const enhanced = enrichFingerprint(fpWithFinancial);
    // 2 (financial) + 2 (external_apis) = 4 >= 3 → medium
    expect(["medium", "high", "critical"]).toContain(enhanced.risk_tier);
  });

  it("risk tier elevated by pii signal", () => {
    const fp = baseFingerprint(tmpDir);
    const fpWithPII: Fingerprint = {
      ...fp,
      security_signals: {
        ...fp.security_signals,
        has_pii: true,
        has_external_apis: true,
        has_auth: true,
      },
    };
    const enhanced = enrichFingerprint(fpWithPII);
    // 1 (pii) + 2 (ext_apis) + 2 (auth) = 5 >= 5 → high
    expect(["high", "critical"]).toContain(enhanced.risk_tier);
  });

  it("risk tier for data sensitive + auth is high", () => {
    const fp = baseFingerprint(tmpDir);
    const fpSensitive: Fingerprint = {
      ...fp,
      security_signals: {
        ...fp.security_signals,
        has_data_sensitive: true,
        has_auth: true,
        has_external_apis: true,
      },
    };
    const enhanced = enrichFingerprint(fpSensitive);
    // 2 (data_sensitive) + 2 (auth) + 2 (ext_apis) = 6 >= 5 → high
    expect(["high", "critical"]).toContain(enhanced.risk_tier);
  });

  it("encryption signal alone is low-medium", () => {
    const fp = baseFingerprint(tmpDir);
    const fpEncryption: Fingerprint = {
      ...fp,
      security_signals: {
        ...fp.security_signals,
        has_encryption: true,
      },
    };
    const enhanced = enrichFingerprint(fpEncryption);
    // 1 (encryption) = 1 < 3 → low
    expect(enhanced.risk_tier).toBe("low");
  });
});
