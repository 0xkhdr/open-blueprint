import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EXIT_CODES } from "../../../src/constants.js";

describe("EXIT_CODES property tests", () => {
  it("all exit code values are integers in [0, 10]", () => {
    for (const [key, value] of Object.entries(EXIT_CODES)) {
      expect(Number.isInteger(value), `${key} should be integer`).toBe(true);
      expect(value, `${key} should be >= 0`).toBeGreaterThanOrEqual(0);
      expect(value, `${key} should be <= 10`).toBeLessThanOrEqual(10);
    }
  });

  it("any sampled exit code value from the object satisfies range invariant", () => {
    const values = Object.values(EXIT_CODES);
    fc.assert(
      fc.property(fc.constantFrom(...values), (code) => {
        return Number.isInteger(code) && code >= 0 && code <= 10;
      })
    );
  });

  it("EXIT_CODES.SUCCESS is 0", () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
  });

  it("all exit codes are unique", () => {
    const values = Object.values(EXIT_CODES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
