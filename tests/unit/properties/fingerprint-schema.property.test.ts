import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FingerprintSchema } from "../../../src/detector/fingerprint.js";
import { fingerprintArbitrary } from "./arbitraries.js";

describe("FingerprintSchema property tests", () => {
  it("valid fingerprint round-trips through JSON serialization", () => {
    fc.assert(
      fc.property(fingerprintArbitrary(), (fp) => {
        const roundTripped = FingerprintSchema.safeParse(
          JSON.parse(JSON.stringify(fp))
        );
        expect(roundTripped.success).toBe(true);
        if (roundTripped.success) {
          expect(roundTripped.data).toEqual(fp);
        }
      }),
      { numRuns: 50 }
    );
  });

  it("invalid inputs throw ZodError, not other error types", () => {
    const invalidArb = fc.oneof(
      fc.record({ version: fc.constant("99.9"), project: fc.anything() }),
      fc.record({ version: fc.constant("1.0"), detected_at: fc.constant("not-a-date") }),
      fc.constant(null),
      fc.constant(undefined),
      fc.string(),
      fc.integer(),
    );

    fc.assert(
      fc.property(invalidArb, (invalid) => {
        const result = FingerprintSchema.safeParse(invalid);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(z.ZodError);
        }
      }),
      { numRuns: 50 }
    );
  });

  it("fingerprint with oversized string field fails schema", () => {
    const oversized = "x".repeat(600);
    const result = FingerprintSchema.safeParse({
      version: "1.0",
      detected_at: new Date().toISOString(),
      project: {
        name: oversized,
        root: "/valid/path",
        type: "application",
        git_workflow: "unknown",
      },
      languages: [],
      frameworks: [],
      entry_points: [],
      tooling: {},
      directory_topology: { src_dirs: [], test_dirs: [], config_dirs: [], package_dirs: [] },
      security_signals: {
        has_auth: false,
        has_external_apis: false,
        has_secrets_manager: false,
        has_docker: false,
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });
});
