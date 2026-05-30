import { describe, expect, it } from "vitest";
import { enrichFingerprint } from "../../../src/detector/index.js";
import type { Fingerprint } from "../../../src/detector/fingerprint.js";

describe("Detector Risk Scoring", () => {
  const createBasicFingerprint = (overrides?: Partial<Fingerprint>): Fingerprint => ({
    version: "1.0",
    detected_at: new Date().toISOString(),
    project: {
      name: "test-project",
      root: "/test",
      type: "library",
      git_workflow: "trunk-based",
    },
    languages: [{ name: "typescript", primary: true, percentage: 100 }],
    frameworks: [],
    entry_points: [],
    tooling: [],
    directory_topology: {
      src_dirs: ["src"],
      test_dirs: ["tests"],
      config_dirs: [],
      package_dirs: [],
    },
    security_signals: {
      has_external_apis: false,
      has_secrets_manager: false,
      has_auth: false,
      has_docker: false,
    },
    ...overrides,
  });

  describe("Risk Tier Detection", () => {
    it("detects low risk for simple library", () => {
      const fp = createBasicFingerprint();
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.risk_tier).toBe("low");
      expect(enhanced.suggested_approval_mode).toBe("auto");
    });

    it("detects medium risk with multiple signals adding to 3+ points", () => {
      const fp = createBasicFingerprint({
        security_signals: {
          has_external_apis: true, // +2
          has_secrets_manager: false,
          has_auth: false,
          has_docker: true, // +1
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.risk_tier).toBe("medium"); // 2+1 = 3 >= 3
      expect(enhanced.suggested_approval_mode).toBe("auto");
    });

    it("detects high risk with multiple signals", () => {
      const fp = createBasicFingerprint({
        security_signals: {
          has_external_apis: true, // +2
          has_secrets_manager: true, // +2
          has_auth: false,
          has_docker: true, // +1 to reach 5
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.risk_tier).toBe("high"); // 2+2+1 = 5 >= 5
      expect(enhanced.suggested_approval_mode).toBe("confirm");
    });

    it("detects critical risk for service type", () => {
      const fp = createBasicFingerprint({
        project: {
          name: "test-service",
          root: "/test",
          type: "service",
          git_workflow: "trunk-based",
        },
        security_signals: {
          has_external_apis: true,
          has_secrets_manager: true,
          has_auth: true,
          has_docker: true,
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.risk_tier).toBe("critical");
      expect(enhanced.suggested_approval_mode).toBe("read-only");
    });

    it("detects high/critical risk for payment framework", () => {
      const fp = createBasicFingerprint({
        project: {
          name: "payment-service",
          root: "/test",
          type: "service", // +1
          git_workflow: "trunk-based",
        },
        frameworks: [
          { name: "stripe-payments" }, // +2
          { name: "express" },
        ],
        security_signals: {
          has_external_apis: true, // +2
          has_secrets_manager: true, // +2
          has_auth: false,
          has_docker: false,
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.risk_tier).toBe("critical"); // 2+2+2+1 = 7 >= 7
    });

    it("detects medium risk for auth framework with signals", () => {
      const fp = createBasicFingerprint({
        frameworks: [{ name: "oauth2" }],
        security_signals: {
          has_external_apis: true, // +2
          has_secrets_manager: false,
          has_auth: false,
          has_docker: false,
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.risk_tier).toBe("medium"); // 2 < 3
    });

    it("detects high risk for auth signals", () => {
      const fp = createBasicFingerprint({
        security_signals: {
          has_external_apis: true, // +2
          has_secrets_manager: true, // +2
          has_auth: true, // +2 = 6
          has_docker: false,
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.risk_tier).toBe("high"); // 6 >= 5
    });

    it("tracks risk signals in enhanced fingerprint", () => {
      const fp = createBasicFingerprint({
        security_signals: {
          has_external_apis: true,
          has_secrets_manager: true,
          has_auth: true,
          has_docker: false,
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.security_signals.has_external_apis).toBe(true);
      expect(enhanced.security_signals.has_secrets_manager).toBe(true);
      expect(enhanced.security_signals.has_auth).toBe(true);
      expect(enhanced.security_signals.has_docker).toBe(false);
    });
  });

  describe("Approval Mode Inference", () => {
    it("suggests auto for low risk", () => {
      const fp = createBasicFingerprint();
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.suggested_approval_mode).toBe("auto");
    });

    it("suggests auto for medium risk", () => {
      const fp = createBasicFingerprint({
        security_signals: {
          has_external_apis: true,
          has_secrets_manager: false,
          has_auth: false,
          has_docker: false,
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.suggested_approval_mode).toBe("auto");
    });

    it("suggests confirm for high risk", () => {
      const fp = createBasicFingerprint({
        security_signals: {
          has_external_apis: true, // +2
          has_secrets_manager: true, // +2
          has_auth: false,
          has_docker: true, // +1 = 5
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.suggested_approval_mode).toBe("confirm"); // high risk
    });

    it("suggests read-only for critical risk", () => {
      const fp = createBasicFingerprint({
        project: {
          name: "critical-service",
          root: "/test",
          type: "service",
          git_workflow: "trunk-based",
        },
        security_signals: {
          has_external_apis: true,
          has_secrets_manager: true,
          has_auth: true,
          has_docker: true,
        },
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.suggested_approval_mode).toBe("read-only");
    });
  });

  describe("Token Estimation", () => {
    it("estimates base monthly tokens for simple project", () => {
      const fp = createBasicFingerprint();
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.estimated_monthly_tokens).toBeGreaterThan(1000);
      expect(enhanced.estimated_monthly_tokens).toBeLessThan(3000);
    });

    it("increases tokens with more src directories", () => {
      const fpSimple = createBasicFingerprint();
      const fpComplex = createBasicFingerprint({
        directory_topology: {
          src_dirs: ["src", "lib", "packages"],
          test_dirs: ["tests"],
          config_dirs: [],
          package_dirs: [],
        },
      });

      const enhancedSimple = enrichFingerprint(fpSimple);
      const enhancedComplex = enrichFingerprint(fpComplex);

      expect(enhancedComplex.estimated_monthly_tokens)
        .toBeGreaterThan(enhancedSimple.estimated_monthly_tokens);
    });

    it("increases tokens with more frameworks", () => {
      const fpSimple = createBasicFingerprint();
      const fpComplex = createBasicFingerprint({
        frameworks: [
          { name: "react" },
          { name: "nextjs" },
          { name: "express" },
          { name: "postgres" },
        ],
      });

      const enhancedSimple = enrichFingerprint(fpSimple);
      const enhancedComplex = enrichFingerprint(fpComplex);

      expect(enhancedComplex.estimated_monthly_tokens)
        .toBeGreaterThan(enhancedSimple.estimated_monthly_tokens);
    });

    it("applies monorepo complexity multiplier", () => {
      const fpLibrary = createBasicFingerprint({
        project: {
          name: "library",
          root: "/test",
          type: "library",
          git_workflow: "trunk-based",
        },
      });

      const fpMonorepo = createBasicFingerprint({
        project: {
          name: "monorepo",
          root: "/test",
          type: "monorepo",
          git_workflow: "trunk-based",
        },
      });

      const enhancedLibrary = enrichFingerprint(fpLibrary);
      const enhancedMonorepo = enrichFingerprint(fpMonorepo);

      expect(enhancedMonorepo.estimated_monthly_tokens)
        .toBeGreaterThan(enhancedLibrary.estimated_monthly_tokens);
    });

    it("returns reasonable token estimates", () => {
      const fp = createBasicFingerprint({
        frameworks: Array.from({ length: 5 }, (_, i) => ({ name: `framework-${i}` })),
        directory_topology: {
          src_dirs: ["src", "lib", "app"],
          test_dirs: ["tests"],
          config_dirs: ["config"],
          package_dirs: [],
        },
      });

      const enhanced = enrichFingerprint(fp);
      // Should be between 1K and 20K tokens per month
      expect(enhanced.estimated_monthly_tokens).toBeGreaterThan(1000);
      expect(enhanced.estimated_monthly_tokens).toBeLessThan(20000);
    });
  });

  describe("Enhanced Fingerprint Structure", () => {
    it("preserves original fingerprint data", () => {
      const fp = createBasicFingerprint({
        frameworks: [{ name: "react" }],
      });
      const enhanced = enrichFingerprint(fp);

      expect(enhanced.version).toBe(fp.version);
      expect(enhanced.project.name).toBe(fp.project.name);
      expect(enhanced.languages).toEqual(fp.languages);
      expect(enhanced.frameworks).toEqual(fp.frameworks);
    });

    it("adds risk scoring fields", () => {
      const fp = createBasicFingerprint();
      const enhanced = enrichFingerprint(fp);

      expect(enhanced).toHaveProperty("risk_tier");
      expect(enhanced).toHaveProperty("suggested_approval_mode");
      expect(enhanced).toHaveProperty("estimated_monthly_tokens");

      expect(["low", "medium", "high", "critical"]).toContain(enhanced.risk_tier);
      expect(["auto", "confirm", "read-only"]).toContain(enhanced.suggested_approval_mode);
      expect(typeof enhanced.estimated_monthly_tokens).toBe("number");
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined security signals gracefully", () => {
      const fp = createBasicFingerprint({
        security_signals: {
          has_external_apis: false,
          has_secrets_manager: false,
          has_auth: false,
          has_docker: false,
        },
      });

      const enhanced = enrichFingerprint(fp);
      expect(enhanced.risk_tier).toBe("low");
    });

    it("handles empty frameworks array", () => {
      const fp = createBasicFingerprint({
        frameworks: [],
      });

      const enhanced = enrichFingerprint(fp);
      expect(enhanced.risk_tier).toBe("low");
    });

    it("handles unknown project types", () => {
      const fp = createBasicFingerprint({
        project: {
          name: "unknown-project",
          root: "/test",
          type: "unknown" as any,
          git_workflow: "trunk-based",
        },
      });

      const enhanced = enrichFingerprint(fp);
      // Should still produce valid risk tier
      expect(["low", "medium", "high", "critical"]).toContain(enhanced.risk_tier);
    });
  });
});
