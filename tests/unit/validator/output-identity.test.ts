import { describe, expect, it } from "vitest";
import {
  computeOutputHash,
  computeSimilarity,
  isOutputIdentical,
} from "../../../src/validator/drift.js";

describe("isOutputIdentical", () => {
  it("returns true for identical hashes", () => {
    const h = computeOutputHash("some output");
    expect(isOutputIdentical(h, h)).toBe(true);
  });

  it("returns false for different hashes", () => {
    expect(isOutputIdentical(computeOutputHash("a"), computeOutputHash("b"))).toBe(false);
  });

  it("treats whitespace/case-only differences as identical (normalized hash)", () => {
    expect(computeOutputHash("Hello  World")).toBe(computeOutputHash("hello world"));
  });
});

describe("computeSimilarity (deprecated alias)", () => {
  it("still returns 1.0 / 0.0 for backward compatibility", () => {
    const h = computeOutputHash("x");
    expect(computeSimilarity(h, h)).toBe(1.0);
    expect(computeSimilarity(h, computeOutputHash("y"))).toBe(0.0);
  });
});
