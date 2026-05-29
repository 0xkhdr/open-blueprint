import type { BlueprintIR } from "../translator/ir.js";

// Semantic diff operations
export type DiffOp = "add" | "remove" | "modify" | "reorder";

export interface DiffChange {
  op: DiffOp;
  path: string; // JSONPath to the changed element
  layer: string; // e.g., "rules", "skills", "personas"
  itemId: string; // id, name, or index
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string; // why this changed (for display)
}

export interface DiffReport {
  baseVersion: string;
  targetVersion: string;
  timestamp: string;
  summary: {
    added: number;
    removed: number;
    modified: number;
    reordered: number;
  };
  changes: DiffChange[];
  metadata: {
    checksum_base: string;
    checksum_target: string;
    compatible: boolean; // can merge without conflicts
  };
}

// Three-way merge conflict
export interface MergeConflict {
  path: string;
  layer: string;
  itemId: string;
  baseValue: unknown;
  oursValue: unknown;
  theirsValue: unknown;
  resolution?: "ours" | "theirs" | "custom";
  customResolution?: unknown;
}

export interface MergeResult {
  success: boolean;
  merged: BlueprintIR;
  conflicts: MergeConflict[];
  applied_changes: number;
  resolution_strategies: Record<string, string>; // which strategy resolved each conflict
  timestamp: string;
}

// Diff strategies
export type DiffStrategy = "deep" | "shallow" | "schemas-only";

export interface DiffOptions {
  strategy: DiffStrategy;
  ignoreMetadata: boolean;
  ignoreOrder: boolean; // treat [a,b,c] same as [c,b,a]
  contextLines: number; // for human-readable output
}

export interface MergeOptions {
  strategy: "ours" | "theirs" | "deep" | "interactive";
  autoResolveStrategy?: (conflict: MergeConflict) => unknown;
  allowPartialMerge: boolean;
}
