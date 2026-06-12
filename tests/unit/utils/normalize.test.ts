import { describe, expect, it } from "vitest";
import { normalizeText, textEquals } from "../../../src/utils/normalize.js";

describe("normalizeText", () => {
  it("collapses internal whitespace runs to a single space", () => {
    expect(normalizeText("a    b\t\tc")).toBe("a b c");
  });

  it("normalizes CRLF and CR line endings", () => {
    expect(normalizeText("a\r\nb\rc")).toBe("a b c");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeText("  hello world  ")).toBe("hello world");
  });

  it("preserves case by default", () => {
    expect(normalizeText("MUST not Use")).toBe("MUST not Use");
  });

  it("folds case when caseInsensitive is set", () => {
    expect(normalizeText("MUST", { caseInsensitive: true })).toBe("must");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeText("   \n\t  ")).toBe("");
  });
});

describe("textEquals", () => {
  it("treats whitespace-only differences as equal", () => {
    expect(textEquals("do  the\tthing", "do the thing")).toBe(true);
  });

  it("treats line-ending differences as equal", () => {
    expect(textEquals("line\r\none", "line\none")).toBe(true);
  });

  it("treats case differences as a real change (fidelity)", () => {
    expect(textEquals("Must", "must")).toBe(false);
  });

  it("detects genuine content differences", () => {
    expect(textEquals("do A", "do B")).toBe(false);
  });
});
