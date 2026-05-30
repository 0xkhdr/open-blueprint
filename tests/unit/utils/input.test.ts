import { describe, expect, it } from "vitest";
import { InputValidationError } from "../../../src/errors.js";
import { validateUserInput } from "../../../src/utils/input.js";

describe("validateUserInput", () => {
  it("returns valid string ≤256 chars unchanged", () => {
    const s = "hello world";
    expect(validateUserInput(s)).toBe(s);
  });

  it("returns valid string of exactly 256 chars", () => {
    const s = "a".repeat(256);
    expect(validateUserInput(s)).toBe(s);
  });

  it("throws InputValidationError for string of 257 chars", () => {
    const s = "a".repeat(257);
    expect(() => validateUserInput(s)).toThrow(InputValidationError);
    expect(() => validateUserInput(s)).toThrow("Input exceeds maximum length of 256 characters");
  });

  it("throws InputValidationError for string containing null byte (\\x00)", () => {
    expect(() => validateUserInput("hello\x00world")).toThrow(InputValidationError);
    expect(() => validateUserInput("hello\x00world")).toThrow(
      "Input contains disallowed null bytes or control characters"
    );
  });

  it("throws InputValidationError for string containing control character (\\x1F)", () => {
    expect(() => validateUserInput("hello\x1fworld")).toThrow(InputValidationError);
    expect(() => validateUserInput("hello\x1fworld")).toThrow(
      "Input contains disallowed null bytes or control characters"
    );
  });
});
