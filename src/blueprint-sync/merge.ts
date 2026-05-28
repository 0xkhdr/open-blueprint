import { BlueprintIR, Rule, Skill, Persona } from "../translator/ir.js";
import {
  MergeResult,
  MergeConflict,
  MergeOptions,
  DiffChange,
} from "./types.js";
import { diffBlueprints } from "./diff.js";

export class BlueprintMerger {
  private defaultOptions: MergeOptions = {
    strategy: "deep",
    allowPartialMerge: true,
  };

  threeWayMerge(
    base: BlueprintIR,
    ours: BlueprintIR,
    theirs: BlueprintIR,
    options: Partial<MergeOptions> = {}
  ): MergeResult {
    const opts = { ...this.defaultOptions, ...options } as MergeOptions;
    const conflicts: MergeConflict[] = [];
    let appliedChanges = 0;
    const resolutionStrategies: Record<string, string> = {};

    // Clone base as starting point
    const merged = JSON.parse(JSON.stringify(base)) as BlueprintIR;

    // Get diffs from base → ours and base → theirs
    const oursChanges = diffBlueprints(base, ours).changes;
    const theirsChanges = diffBlueprints(base, theirs).changes;

    // Handle scalar field conflicts (like spatial_anchor)
    for (const ourChange of oursChanges) {
      for (const theirChange of theirsChanges) {
        if (
          ourChange.path === theirChange.path &&
          !ourChange.path.includes("[") &&
          ourChange.layer === "spatial_anchor"
        ) {
          // Spatial anchor conflict
          if (!this.deepEqual(ourChange.newValue, theirChange.newValue)) {
            const conflict: MergeConflict = {
              path: ourChange.path,
              layer: ourChange.layer,
              itemId: ourChange.itemId,
              baseValue: ourChange.oldValue,
              oursValue: ourChange.newValue,
              theirsValue: theirChange.newValue,
            };
            conflicts.push(conflict);

            // Auto-resolve
            if (opts.autoResolveStrategy) {
              const resolved = opts.autoResolveStrategy(conflict);
              conflict.customResolution = resolved;
              conflict.resolution = "custom";
              this.setNestedValue(merged, ourChange.path, resolved);
              appliedChanges++;
            }
          }
        }
      }
    }

    // Apply non-conflicting scalar changes
    for (const ourChange of oursChanges) {
      if (!ourChange.path.includes("[") && ourChange.layer === "spatial_anchor") {
        const hasConflict = conflicts.some((c) => c.path === ourChange.path);
        if (!hasConflict) {
          this.setNestedValue(merged, ourChange.path, ourChange.newValue);
          appliedChanges++;
        }
      }
    }

    // Merge array-based layers
    appliedChanges += this.mergeArrayLayer(
      merged.personas,
      base.personas,
      ours.personas,
      theirs.personas,
      "personas",
      (p) => p.name,
      conflicts,
      resolutionStrategies,
      opts
    );

    appliedChanges += this.mergeArrayLayer(
      merged.rules,
      base.rules,
      ours.rules,
      theirs.rules,
      "rules",
      (r) => r.id,
      conflicts,
      resolutionStrategies,
      opts
    );

    appliedChanges += this.mergeArrayLayer(
      merged.skills,
      base.skills,
      ours.skills,
      theirs.skills,
      "skills",
      (s) => s.name,
      conflicts,
      resolutionStrategies,
      opts
    );

    const success = conflicts.length === 0 || opts.allowPartialMerge !== false;

    return {
      success,
      merged,
      conflicts,
      applied_changes: appliedChanges,
      resolution_strategies: resolutionStrategies,
      timestamp: new Date().toISOString(),
    };
  }

  private mergeArrayLayer<T extends { id?: string; name?: string }>(
    mergedArray: T[],
    baseArray: T[] | undefined,
    oursArray: T[] | undefined,
    theirsArray: T[] | undefined,
    layer: string,
    getId: (item: T) => string,
    conflicts: MergeConflict[],
    strategies: Record<string, string>,
    opts: MergeOptions
  ): number {
    let count = 0;
    const base = baseArray ?? [];
    const ours = oursArray ?? [];
    const theirs = theirsArray ?? [];

    // Build maps
    const baseMap = new Map(base.map((item) => [getId(item), item]));
    const oursMap = new Map(ours.map((item) => [getId(item), item]));
    const theirsMap = new Map(theirs.map((item) => [getId(item), item]));

    // Merge: process all unique IDs
    const allIds = new Set([
      ...baseMap.keys(),
      ...oursMap.keys(),
      ...theirsMap.keys(),
    ]);

    for (const id of allIds) {
      const baseItem = baseMap.get(id);
      const oursItem = oursMap.get(id);
      const theirsItem = theirsMap.get(id);

      // Both changed and differ = conflict
      if (
        oursItem &&
        theirsItem &&
        !this.deepEqual(oursItem, theirsItem)
      ) {
        conflicts.push({
          path: `${layer}[${id}]`,
          layer,
          itemId: id,
          baseValue: baseItem,
          oursValue: oursItem,
          theirsValue: theirsItem,
        });

        // Auto-resolve if strategy provided
        if (opts.autoResolveStrategy) {
          const newConflict: MergeConflict = {
            path: `${layer}[${id}]`,
            layer,
            itemId: id,
            baseValue: baseItem,
            oursValue: oursItem,
            theirsValue: theirsItem,
          };
          const resolved = opts.autoResolveStrategy(newConflict);
          newConflict.customResolution = resolved;
          newConflict.resolution = "custom";

          // Update merged array
          const idx = mergedArray.findIndex((item) => getId(item) === id);
          if (idx >= 0) {
            mergedArray[idx] = resolved as T;
          } else {
            // If not in merged, this is a new addition
            mergedArray.push(resolved as T);
          }
          count++;
        }
      }
      // Only ours removed (theirs unchanged or not present)
      else if (!oursItem && baseItem) {
        // Remove it
        strategies[`${layer}[${id}]`] = "ours-remove";
        // Will be filtered out below
      }
      // Only theirs removed (ours unchanged or not present)
      else if (!theirsItem && baseItem) {
        // Remove it
        strategies[`${layer}[${id}]`] = "theirs-remove";
        // Will be filtered out below
      }
      // Both added same item
      else if (oursItem && theirsItem && this.deepEqual(oursItem, theirsItem)) {
        // No change needed, already in merged
        strategies[`${layer}[${id}]`] = "both-same";
      }
      // Only ours added
      else if (oursItem && !baseItem) {
        mergedArray.push(oursItem);
        strategies[`${layer}[${id}]`] = "ours-add";
        count++;
      }
      // Only theirs added
      else if (theirsItem && !baseItem) {
        mergedArray.push(theirsItem);
        strategies[`${layer}[${id}]`] = "theirs-add";
        count++;
      }
    }

    // Remove items that were removed on either side (but not both sides changed it)
    const toRemove = new Set<string>();
    for (const id of baseMap.keys()) {
      const oursItem = oursMap.get(id);
      const theirsItem = theirsMap.get(id);

      // If either side removed and the other didn't change it, remove it
      if (!oursItem && !theirsItem) {
        toRemove.add(id);
      } else if (!oursItem && theirsItem) {
        // Only ours removed, accept it
        toRemove.add(id);
      } else if (oursItem && !theirsItem) {
        // Only theirs removed, accept it
        toRemove.add(id);
      }
    }

    // Actually remove from merged
    const filtered = mergedArray.filter((item) => !toRemove.has(getId(item)));
    mergedArray.length = 0;
    mergedArray.push(...filtered);
    count += toRemove.size;

    return count;
  }



  private setNestedValue(
    obj: unknown,
    path: string,
    value: unknown
  ): void {
    const parts = path.split(".");
    if (parts.length === 0) return;

    let current = obj as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) continue;
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value;
    }
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, idx) => this.deepEqual(item, b[idx]));
    }

    if (typeof a === "object" && typeof b === "object") {
      const keysA = Object.keys(a as Record<string, unknown>);
      const keysB = Object.keys(b as Record<string, unknown>);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) =>
        this.deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      );
    }

    return false;
  }
}

export function mergeBlueprints(
  base: BlueprintIR,
  ours: BlueprintIR,
  theirs: BlueprintIR,
  options?: Partial<MergeOptions>
): MergeResult {
  const merger = new BlueprintMerger();
  return merger.threeWayMerge(base, ours, theirs, options);
}
