import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { mergeBlueprints } from "../../blueprint-sync/merge.js";
import type { MergeConflict, MergeOptions } from "../../blueprint-sync/types.js";
import { BpError } from "../../errors.js";
import { BlueprintIRSchema } from "../../translator/ir.js";
import { resolveAndValidatePath } from "../../utils/paths.js";

export function createMergeCommand(): Command {
  return new Command("merge")
    .description("Three-way merge of blueprints with conflict detection and resolution")
    .argument("<base>", "Base blueprint file")
    .argument("<ours>", "Our version blueprint file")
    .argument("<theirs>", "Their version blueprint file")
    .option("-o, --output <file>", "Write merged blueprint to file")
    .option(
      "-s, --strategy <strategy>",
      "Conflict resolution: ours, theirs, deep, interactive",
      "deep"
    )
    .option("--allow-partial", "Allow merge with unresolved conflicts", false)
    .action(async (baseFile: string, oursFile: string, theirsFile: string, options) => {
      try {
        // Read and parse blueprints
        const baseContent = fs.readFileSync(path.resolve(baseFile), "utf-8");
        const oursContent = fs.readFileSync(path.resolve(oursFile), "utf-8");
        const theirsContent = fs.readFileSync(path.resolve(theirsFile), "utf-8");

        const base = BlueprintIRSchema.parse(JSON.parse(baseContent));
        const ours = BlueprintIRSchema.parse(JSON.parse(oursContent));
        const theirs = BlueprintIRSchema.parse(JSON.parse(theirsContent));

        // Auto-resolve strategy
        let autoResolve: ((c: MergeConflict) => unknown) | undefined;
        if (options.strategy === "ours") {
          autoResolve = (c) => c.oursValue;
        } else if (options.strategy === "theirs") {
          autoResolve = (c) => c.theirsValue;
        }

        // Perform merge
        const mergeOpts: Partial<MergeOptions> = {};
        if (options.strategy) {
          mergeOpts.strategy = options.strategy as "ours" | "theirs" | "deep" | "interactive";
        }
        if (autoResolve) {
          mergeOpts.autoResolveStrategy = autoResolve;
        }
        if (options.allowPartial !== undefined) {
          mergeOpts.allowPartialMerge = options.allowPartial as boolean;
        }

        const result = mergeBlueprints(base, ours, theirs, mergeOpts);

        // Output merged blueprint
        if (options.output) {
          fs.writeFileSync(
            resolveAndValidatePath(options.output as string, process.cwd()),
            JSON.stringify(result.merged, null, 2)
          );
          console.log(`✅ Merged blueprint written to: ${options.output}`);
        } else {
          console.log(JSON.stringify(result.merged, null, 2));
        }

        // Report conflicts
        if (result.conflicts.length > 0) {
          console.error(`\n⚠️  ${result.conflicts.length} conflict(s) detected:\n`);
          for (const conflict of result.conflicts) {
            reportConflict(conflict);
          }

          if (!result.success) {
            console.error("\n❌ Merge failed with unresolved conflicts.");
            throw new BpError(
              `Merge failed with ${result.conflicts.length} unresolved conflict(s). Fix: Use --strategy ours or --strategy theirs to auto-resolve, or --allow-partial to proceed.`,
              1,
              "MERGE_CONFLICT",
              "Fix: Use --strategy ours or --strategy theirs."
            );
          } else {
            console.log(`\n✅ Conflicts auto-resolved using '${options.strategy}' strategy.`);
          }
        } else {
          console.log(`✅ Clean merge: ${result.applied_changes} changes applied.`);
        }
      } catch (error) {
        if (error instanceof BpError) throw error;
        console.error("Error:", error instanceof Error ? error.message : String(error));
        throw new BpError(
          `Merge failed: ${error instanceof Error ? error.message : String(error)}. See: docs/errors.md#code-1`,
          1,
          "MERGE_ERROR",
          "See: docs/errors.md#code-1"
        );
      }
    });
}

function reportConflict(conflict: MergeConflict): void {
  console.error(`  Path: ${conflict.path}`);
  console.error(`  Layer: ${conflict.layer}`);
  console.error(`  Item: ${conflict.itemId}`);
  console.error(`    Base:   ${JSON.stringify(conflict.baseValue)}`);
  console.error(`    Ours:   ${JSON.stringify(conflict.oursValue)}`);
  console.error(`    Theirs: ${JSON.stringify(conflict.theirsValue)}`);
  if (conflict.resolution) {
    console.error(`    ✅ Resolved: ${conflict.resolution}`);
  } else {
    console.error(`    ❌ Unresolved`);
  }
  console.error("");
}
