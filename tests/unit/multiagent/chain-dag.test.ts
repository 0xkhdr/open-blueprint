import { describe, expect, it } from "vitest";
import {
  fromIRChain,
  validateChainDAG,
  type ChainConfig,
} from "../../../src/multiagent/chains.js";

function makeChain(overrides: Partial<ChainConfig> = {}): ChainConfig {
  return {
    name: "test-chain",
    steps: [],
    ...overrides,
  };
}

describe("validateChainDAG", () => {
  it("returns valid for empty steps", () => {
    const result = validateChainDAG(makeChain());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("warns on empty steps chain", () => {
    const result = validateChainDAG(makeChain());
    expect(result.warnings.some((w) => w.includes("no steps"))).toBe(true);
  });

  it("returns valid for linear chain without input_from", () => {
    const result = validateChainDAG(
      makeChain({
        steps: [
          { agent: "a1", action: "ingest" },
          { agent: "a2", action: "process" },
          { agent: "a3", action: "output" },
        ],
      })
    );
    expect(result.valid).toBe(true);
  });

  it("returns valid for chain with valid input_from reference", () => {
    const result = validateChainDAG(
      makeChain({
        steps: [
          { agent: "a1", action: "ingest" },
          { agent: "a2", action: "process", input_from: "ingest" },
        ],
      })
    );
    expect(result.valid).toBe(true);
  });

  it("detects unresolved input_from reference", () => {
    const result = validateChainDAG(
      makeChain({
        steps: [
          { agent: "a1", action: "ingest" },
          { agent: "a2", action: "process", input_from: "nonexistent" },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unresolved input reference"))).toBe(true);
  });

  it("detects direct cycle (A → A)", () => {
    const result = validateChainDAG(
      makeChain({
        steps: [
          { agent: "a1", action: "step1" },
          { agent: "a1", action: "step2", input_from: "step1" },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Circular dependency"))).toBe(true);
  });

  it("detects two-node cycle (A → B → A)", () => {
    const result = validateChainDAG(
      makeChain({
        steps: [
          { agent: "a1", action: "step1" },
          { agent: "a2", action: "step2", input_from: "step1" },
          { agent: "a1", action: "step3", input_from: "step2" },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Circular dependency"))).toBe(true);
  });

  it("detects three-node cycle", () => {
    const result = validateChainDAG(
      makeChain({
        steps: [
          { agent: "a1", action: "s1" },
          { agent: "a2", action: "s2", input_from: "s1" },
          { agent: "a3", action: "s3", input_from: "s2" },
          { agent: "a1", action: "s4", input_from: "s3" },
        ],
      })
    );
    expect(result.valid).toBe(false);
  });

  it("passes linear chain A → B → C (no cycles)", () => {
    const result = validateChainDAG(
      makeChain({
        steps: [
          { agent: "a1", action: "s1" },
          { agent: "a2", action: "s2", input_from: "s1" },
          { agent: "a3", action: "s3", input_from: "s2" },
        ],
      })
    );
    expect(result.valid).toBe(true);
  });

  it("returns multiple errors for multiple issues", () => {
    const result = validateChainDAG(
      makeChain({
        steps: [
          { agent: "a1", action: "s1", input_from: "missing1" },
          { agent: "a2", action: "s2", input_from: "missing2" },
        ],
      })
    );
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("valid field is false when errors > 0", () => {
    const result = validateChainDAG(
      makeChain({
        steps: [{ agent: "a1", action: "s1", input_from: "ghost" }],
      })
    );
    expect(result.valid).toBe(false);
  });

  it("handles single step with no input_from", () => {
    const result = validateChainDAG(
      makeChain({ steps: [{ agent: "solo", action: "run" }] })
    );
    expect(result.valid).toBe(true);
  });

  it("warns when same agent appears in multiple steps without parallel_mode", () => {
    const result = validateChainDAG(
      makeChain({
        parallel_mode: false,
        steps: [
          { agent: "a1", action: "s1" },
          { agent: "a1", action: "s2" },
        ],
      })
    );
    expect(result.warnings.some((w) => w.includes("parallel_mode"))).toBe(true);
  });

  it("no parallel_mode warning when parallel_mode=true", () => {
    const result = validateChainDAG(
      makeChain({
        parallel_mode: true,
        steps: [
          { agent: "a1", action: "s1" },
          { agent: "a1", action: "s2" },
        ],
      })
    );
    expect(result.warnings.some((w) => w.includes("parallel_mode"))).toBe(false);
  });
});

describe("fromIRChain", () => {
  it("converts IR chain format to ChainConfig", () => {
    const config = fromIRChain({
      chain_name: "my-chain",
      sequence: ["a1", "a2", "a3"],
    });
    expect(config.name).toBe("my-chain");
    expect(config.steps).toHaveLength(3);
    expect(config.steps[0].agent).toBe("a1");
    expect(config.steps[1].agent).toBe("a2");
    expect(config.steps[2].agent).toBe("a3");
  });

  it("preserves parallel_mode and error_handler", () => {
    const config = fromIRChain({
      chain_name: "c",
      sequence: ["a1"],
      parallel_mode: true,
      error_handler: "fallback",
    });
    expect(config.parallel_mode).toBe(true);
    expect(config.error_handler).toBe("fallback");
  });

  it("assigns sequential action names", () => {
    const config = fromIRChain({ chain_name: "c", sequence: ["a", "b"] });
    expect(config.steps[0].action).toBe("step_0");
    expect(config.steps[1].action).toBe("step_1");
  });
});
