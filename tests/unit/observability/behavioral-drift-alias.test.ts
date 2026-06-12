import { describe, expect, it } from "vitest";
import {
  detectBehavioralDrift,
  detectSemanticDrift,
} from "../../../src/observability/semantic-drift.js";

describe("behavioral drift naming", () => {
  it("exposes detectBehavioralDrift as the canonical name", () => {
    expect(typeof detectBehavioralDrift).toBe("function");
  });

  it("keeps detectSemanticDrift as a backward-compatible alias", () => {
    expect(detectSemanticDrift).toBe(detectBehavioralDrift);
  });
});
