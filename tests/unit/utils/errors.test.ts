import { describe, expect, it } from "vitest";
import { normalizeError } from "../../../src/utils/errors.js";

describe("normalizeError", () => {
  it("returns same Error instance when given an Error", () => {
    const e = new Error("x");
    expect(normalizeError(e)).toBe(e);
  });

  it("converts string to Error with that message", () => {
    const result = normalizeError("msg");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("msg");
  });

  it("converts number to Error via String()", () => {
    const result = normalizeError(42);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("42");
  });

  it("converts null to Error via String()", () => {
    const result = normalizeError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });

  it("converts plain object to Error via String()", () => {
    const result = normalizeError({ foo: 1 });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });
});
