import { describe, expect, it } from "vitest";
import { detectHookCycles } from "../../../src/validator/hook.js";
import type { HookDependencyGraph } from "../../../src/validator/hook.js";

describe("detectHookCycles", () => {
  it("returns hasCycle=false for empty graph", () => {
    const result = detectHookCycles({});
    expect(result.hasCycle).toBe(false);
  });

  it("returns hasCycle=false for acyclic graph", () => {
    const graph: HookDependencyGraph = {
      "pre_tool_use": ["utils"],
      "post_tool_use": ["utils"],
      "utils": [],
    };
    const result = detectHookCycles(graph);
    expect(result.hasCycle).toBe(false);
    expect(result.cyclePath).toBeUndefined();
  });

  it("detects direct cycle (A → B → A)", () => {
    const graph: HookDependencyGraph = {
      "hookA": ["hookB"],
      "hookB": ["hookA"],
    };
    const result = detectHookCycles(graph);
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath).toBeDefined();
    expect(result.cyclePath!.length).toBeGreaterThanOrEqual(2);
  });

  it("detects indirect cycle (A → B → C → A)", () => {
    const graph: HookDependencyGraph = {
      "hookA": ["hookB"],
      "hookB": ["hookC"],
      "hookC": ["hookA"],
    };
    const result = detectHookCycles(graph);
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath).toBeDefined();
  });

  it("detects self-reference (A → A)", () => {
    const graph: HookDependencyGraph = {
      "hookA": ["hookA"],
    };
    const result = detectHookCycles(graph);
    expect(result.hasCycle).toBe(true);
  });

  it("handles graph with multiple disconnected components, no cycles", () => {
    const graph: HookDependencyGraph = {
      "a": ["b"],
      "b": [],
      "c": ["d"],
      "d": [],
    };
    const result = detectHookCycles(graph);
    expect(result.hasCycle).toBe(false);
  });

  it("handles graph where dependency not defined as a node", () => {
    const graph: HookDependencyGraph = {
      "hookA": ["external-dep"],
    };
    const result = detectHookCycles(graph);
    expect(result.hasCycle).toBe(false);
  });
});
