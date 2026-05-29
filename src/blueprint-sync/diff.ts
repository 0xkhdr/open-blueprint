import { createHash } from "node:crypto";
import type { BlueprintIR } from "../translator/ir.js";
import type { DiffChange, DiffOptions, DiffReport } from "./types.js";

export class BlueprintDiffer {
  private defaultOptions: DiffOptions = {
    strategy: "deep",
    ignoreMetadata: false,
    ignoreOrder: false,
    contextLines: 3,
  };

  diff(base: BlueprintIR, target: BlueprintIR, options: Partial<DiffOptions> = {}): DiffReport {
    const opts = { ...this.defaultOptions, ...options };
    const changes: DiffChange[] = [];

    // Compare spatial anchor
    this.diffSpatialAnchor(base, target, changes);

    // Compare personas
    this.diffArray(base.personas, target.personas, "personas", (p) => p.name, changes);

    // Compare rules
    this.diffArray(base.rules, target.rules, "rules", (r) => r.id, changes);

    // Compare skills
    this.diffArray(base.skills, target.skills, "skills", (s) => s.name, changes);

    // Compare hooks
    this.diffArray(base.hooks, target.hooks, "hooks", (h) => h.event, changes);

    // Compare commands if present
    if (base.commands || target.commands) {
      this.diffArray(
        base.commands || [],
        target.commands || [],
        "commands",
        (c) => c.name,
        changes
      );
    }

    // Compare enterprise layers
    if (!opts.ignoreMetadata) {
      this.diffOptional(base.settings, target.settings, "settings", changes);
      this.diffOptional(base.identity, target.identity, "identity", changes);
      this.diffOptional(base.compliance, target.compliance, "compliance", changes);
      this.diffOptional(base.risk, target.risk, "risk", changes);
    }

    // Summary
    const summary = {
      added: changes.filter((c) => c.op === "add").length,
      removed: changes.filter((c) => c.op === "remove").length,
      modified: changes.filter((c) => c.op === "modify").length,
      reordered: changes.filter((c) => c.op === "reorder").length,
    };

    const checksum_base = this.computeChecksum(base);
    const checksum_target = this.computeChecksum(target);

    return {
      baseVersion: base.version,
      targetVersion: target.version,
      timestamp: new Date().toISOString(),
      summary,
      changes,
      metadata: {
        checksum_base,
        checksum_target,
        compatible: changes.length === 0 || !this.hasConflictingChanges(changes),
      },
    };
  }

  private diffSpatialAnchor(base: BlueprintIR, target: BlueprintIR, changes: DiffChange[]): void {
    const baseAnchor = base.spatial_anchor;
    const targetAnchor = target.spatial_anchor;

    if (baseAnchor.project_name !== targetAnchor.project_name) {
      changes.push({
        op: "modify",
        path: "spatial_anchor.project_name",
        layer: "spatial_anchor",
        itemId: "project_name",
        oldValue: baseAnchor.project_name,
        newValue: targetAnchor.project_name,
      });
    }

    if (baseAnchor.surface !== targetAnchor.surface) {
      changes.push({
        op: "modify",
        path: "spatial_anchor.surface",
        layer: "spatial_anchor",
        itemId: "surface",
        oldValue: baseAnchor.surface,
        newValue: targetAnchor.surface,
      });
    }

    if (baseAnchor.temporal_anchor !== targetAnchor.temporal_anchor) {
      changes.push({
        op: "modify",
        path: "spatial_anchor.temporal_anchor",
        layer: "spatial_anchor",
        itemId: "temporal_anchor",
        oldValue: baseAnchor.temporal_anchor,
        newValue: targetAnchor.temporal_anchor,
      });
    }
  }

  private diffArray<T extends { id?: string; name?: string; event?: string }>(
    baseArr: T[] | undefined,
    targetArr: T[] | undefined,
    layer: string,
    getId: (item: T) => string,
    changes: DiffChange[]
  ): void {
    const base = baseArr ?? [];
    const target = targetArr ?? [];
    const baseMap = new Map(
      base.map((item) => {
        const id = getId(item);
        return [id, item] as const;
      })
    );
    const targetMap = new Map(
      target.map((item) => {
        const id = getId(item);
        return [id, item] as const;
      })
    );

    // Detect adds
    for (const item of target) {
      const id = getId(item);
      if (!baseMap.has(id)) {
        changes.push({
          op: "add",
          path: `${layer}[${id}]`,
          layer,
          itemId: id,
          newValue: item,
          reason: `Added ${layer} item: ${id}`,
        });
      }
    }

    // Detect removes
    for (const item of base) {
      const id = getId(item);
      if (!targetMap.has(id)) {
        changes.push({
          op: "remove",
          path: `${layer}[${id}]`,
          layer,
          itemId: id,
          oldValue: item,
          reason: `Removed ${layer} item: ${id}`,
        });
      }
    }

    // Detect modifies
    for (const item of target) {
      const id = getId(item);
      const baseItem = baseMap.get(id);
      if (baseItem && !this.deepEqual(baseItem, item)) {
        const diffs = this.diffObject(baseItem, item);
        for (const diff of diffs) {
          changes.push({
            op: "modify",
            path: `${layer}[${id}].${diff.field}`,
            layer,
            itemId: id,
            oldValue: diff.oldValue,
            newValue: diff.newValue,
            reason: `Modified ${layer}[${id}].${diff.field}`,
          });
        }
      }
    }
  }

  private diffOptional(
    baseValue: unknown,
    targetValue: unknown,
    layer: string,
    changes: DiffChange[]
  ): void {
    if (!baseValue && !targetValue) return;

    if (!baseValue && targetValue) {
      changes.push({
        op: "add",
        path: layer,
        layer,
        itemId: layer,
        newValue: targetValue,
      });
    } else if (baseValue && !targetValue) {
      changes.push({
        op: "remove",
        path: layer,
        layer,
        itemId: layer,
        oldValue: baseValue,
      });
    } else if (!this.deepEqual(baseValue, targetValue)) {
      changes.push({
        op: "modify",
        path: layer,
        layer,
        itemId: layer,
        oldValue: baseValue,
        newValue: targetValue,
      });
    }
  }

  private diffObject(
    baseObj: unknown,
    targetObj: unknown
  ): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    const diffs: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    if (typeof baseObj !== "object" || typeof targetObj !== "object") {
      return diffs;
    }

    const baseKeys = new Set(Object.keys(baseObj as Record<string, unknown>));
    const targetKeys = new Set(Object.keys(targetObj as Record<string, unknown>));

    // Check modified and removed
    for (const key of baseKeys) {
      const baseVal = (baseObj as Record<string, unknown>)[key];
      const targetVal = (targetObj as Record<string, unknown>)[key];
      if (!this.deepEqual(baseVal, targetVal)) {
        diffs.push({
          field: key,
          oldValue: baseVal,
          newValue: targetVal,
        });
      }
    }

    // Check added
    for (const key of targetKeys) {
      if (!baseKeys.has(key)) {
        diffs.push({
          field: key,
          oldValue: undefined,
          newValue: (targetObj as Record<string, unknown>)[key],
        });
      }
    }

    return diffs;
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
        this.deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
      );
    }

    return false;
  }

  private computeChecksum(ir: BlueprintIR): string {
    const normalized = JSON.stringify(ir, Object.keys(ir).sort());
    return createHash("sha256").update(normalized).digest("hex").slice(0, 8);
  }

  private hasConflictingChanges(changes: DiffChange[]): boolean {
    // Simple heuristic: if same layer has both adds and removes of same type, potential conflict
    const byLayer = new Map<string, DiffChange[]>();
    for (const change of changes) {
      if (!byLayer.has(change.layer)) {
        byLayer.set(change.layer, []);
      }
      byLayer.get(change.layer)?.push(change);
    }

    // No conflicts detected at diff level (merge will detect actual conflicts)
    return false;
  }
}

export function diffBlueprints(
  base: BlueprintIR,
  target: BlueprintIR,
  options?: Partial<DiffOptions>
): DiffReport {
  const differ = new BlueprintDiffer();
  return differ.diff(base, target, options);
}
