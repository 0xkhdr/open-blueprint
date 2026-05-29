import * as fs from "node:fs";
import { scanForSecrets } from "../security/scan.js";
import type { ValidationError } from "./structural.js";

export function validateHookSafety(filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!fs.existsSync(filePath)) {
    errors.push({
      file: filePath,
      type: "HOOK_NOT_FOUND",
      severity: "error",
      message: `Hook file does not exist: ${filePath}`,
      resolution: "Create the hook file first, or run `bp hook generate`.",
    });
    return errors;
  }

  const content = fs.readFileSync(filePath, "utf-8");

  // Check forbidden keywords/API calls
  const forbiddenPatterns = [
    {
      regex: /child_process|exec|spawn|fork/i,
      type: "UNSAFE_HOOK_EXECUTION",
      message:
        "Hook file uses unsafe process execution APIs ('child_process', 'exec', 'spawn', 'fork')",
      resolution: "Hooks should remain logic stubs only. Avoid triggering external shell commands.",
    },
    {
      regex: /fetch|http\.|https\.|axios|request/i,
      type: "UNSAFE_HOOK_NETWORK",
      message: "Hook file makes network requests using 'fetch', 'http', 'https', or 'axios'",
      resolution:
        "Avoid performing network operations inside repository hooks to ensure offline reliability.",
    },
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(content)) {
      errors.push({
        file: filePath,
        type: pattern.type,
        severity: "error",
        message: pattern.message,
        resolution: pattern.resolution,
      });
    }
  }

  // Also run secret scan on hook file
  errors.push(...scanForSecrets(filePath, content));

  return errors;
}

// Hook dependency graph cycle detection using DFS with gray/black marking
type NodeColor = "white" | "gray" | "black";

export interface HookDependencyGraph {
  [hookName: string]: string[];
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath?: string[] | undefined;
}

export function detectHookCycles(graph: HookDependencyGraph): CycleDetectionResult {
  const color = new Map<string, NodeColor>();
  const parent = new Map<string, string | null>();

  // Initialize all nodes as white (unvisited)
  for (const node of Object.keys(graph)) {
    color.set(node, "white");
    parent.set(node, null);
  }
  // Also include nodes that appear as dependencies but may not have their own entry
  for (const deps of Object.values(graph)) {
    for (const dep of deps) {
      if (!color.has(dep)) {
        color.set(dep, "white");
        parent.set(dep, null);
      }
    }
  }

  let cyclePath: string[] | undefined;

  function dfs(node: string): boolean {
    color.set(node, "gray");

    const deps = graph[node] ?? [];
    for (const dep of deps) {
      if (color.get(dep) === "gray") {
        // Back edge found — cycle detected. Reconstruct path.
        const path: string[] = [dep, node];
        let cur: string | null = node;
        while (cur !== null && cur !== dep) {
          const p = parent.get(cur);
          if (p === undefined || p === null) break;
          path.unshift(p);
          cur = p;
        }
        cyclePath = path;
        return true;
      }
      if (color.get(dep) === "white") {
        parent.set(dep, node);
        if (dfs(dep)) return true;
      }
    }

    color.set(node, "black");
    return false;
  }

  for (const node of [...color.keys()]) {
    if (color.get(node) === "white") {
      if (dfs(node)) {
        return { hasCycle: true, cyclePath };
      }
    }
  }

  return { hasCycle: false };
}
