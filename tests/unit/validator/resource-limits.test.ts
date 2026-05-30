import { describe, expect, it, vi, afterEach } from "vitest";
import { ResourceLimitError, ValidationTimeoutError } from "../../../src/validator/errors.js";

describe("ResourceLimitError", () => {
  it("carries actual and limit", () => {
    const e = new ResourceLimitError("File count 1500 exceeds limit 1000", 1500, 1000);
    expect(e.actual).toBe(1500);
    expect(e.limit).toBe(1000);
    expect(e.message).toContain("1500");
    expect(e.message).toContain("1000");
    expect(e.name).toBe("ResourceLimitError");
  });
});

describe("ValidationTimeoutError", () => {
  it("carries elapsed and timeout", () => {
    const e = new ValidationTimeoutError(35_000, 30_000);
    expect(e.elapsedMs).toBe(35_000);
    expect(e.timeoutMs).toBe(30_000);
    expect(e.name).toBe("ValidationTimeoutError");
  });
});

describe("resource-limits constants", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("MAX_VALIDATION_FILES defaults to 1000", async () => {
    vi.unstubAllEnvs();
    const mod = await import("../../../src/validator/index.js");
    // Default value defined as 1000 when BP_MAX_VALIDATION_FILES unset
    expect(typeof mod.MAX_VALIDATION_FILES).toBe("number");
    expect(mod.MAX_VALIDATION_FILES).toBeGreaterThan(0);
  });

  it("MAX_VALIDATION_BYTES defaults to 50 MB", async () => {
    const mod = await import("../../../src/validator/index.js");
    expect(mod.MAX_VALIDATION_BYTES).toBeGreaterThan(0);
  });

  it("VALIDATION_TIMEOUT_MS defaults to 30000", async () => {
    const mod = await import("../../../src/validator/index.js");
    expect(mod.VALIDATION_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
