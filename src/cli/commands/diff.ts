import { Command } from "commander";
import fs from "fs";
import path from "path";
import { diffBlueprints } from "../../blueprint-sync/diff.js";
import { BlueprintIRSchema } from "../../translator/ir.js";

export function createDiffCommand(): Command {
  return new Command("diff")
    .description("Show semantic diff between two blueprints")
    .argument("<file1>", "First blueprint file")
    .argument("<file2>", "Second blueprint file")
    .option("-f, --format <format>", "Output format: text, json, markdown", "text")
    .option("--ignore-metadata", "Ignore metadata and optional layers", false)
    .option("--ignore-order", "Ignore array order", false)
    .action(async (file1: string, file2: string, options) => {
      try {
        // Read and parse blueprints
        const content1 = fs.readFileSync(path.resolve(file1), "utf-8");
        const content2 = fs.readFileSync(path.resolve(file2), "utf-8");

        const ir1 = BlueprintIRSchema.parse(JSON.parse(content1));
        const ir2 = BlueprintIRSchema.parse(JSON.parse(content2));

        // Generate diff
        const report = diffBlueprints(ir1, ir2, {
          strategy: "deep",
          ignoreMetadata: options.ignoreMetadata,
          ignoreOrder: options.ignoreOrder,
        });

        // Format output
        const output = formatDiffReport(report, options.format);
        console.log(output);

        // Exit code: 0 if identical, 1 if differences
        process.exit(report.changes.length === 0 ? 0 : 1);
      } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

function formatDiffReport(report: ReturnType<typeof diffBlueprints>, format: string): string {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  if (format === "markdown") {
    return formatMarkdown(report);
  }

  // Default text format
  return formatText(report);
}

function formatText(report: ReturnType<typeof diffBlueprints>): string {
  const lines = [
    `Diff Report: ${report.baseVersion} → ${report.targetVersion}`,
    `Generated: ${report.timestamp}`,
    "",
    `Summary:`,
    `  Added:    ${report.summary.added}`,
    `  Removed:  ${report.summary.removed}`,
    `  Modified: ${report.summary.modified}`,
    `  Reordered: ${report.summary.reordered}`,
    "",
    `Metadata:`,
    `  Base checksum:   ${report.metadata.checksum_base}`,
    `  Target checksum: ${report.metadata.checksum_target}`,
    `  Compatible:      ${report.metadata.compatible ? "Yes" : "No"}`,
    "",
  ];

  if (report.changes.length === 0) {
    lines.push("No changes detected.");
    return lines.join("\n");
  }

  lines.push("Changes:");
  const byLayer = new Map<string, typeof report.changes>();
  for (const change of report.changes) {
    if (!byLayer.has(change.layer)) {
      byLayer.set(change.layer, []);
    }
    byLayer.get(change.layer)!.push(change);
  }

  const icons: Record<string, string> = {
    add: "+",
    remove: "-",
    modify: "~",
    reorder: "→",
  };

  for (const [layer, changes] of byLayer.entries()) {
    lines.push(`\n  ${layer}:`);
    for (const change of changes) {
      const icon = icons[change.op] ?? "?";
      lines.push(`    ${icon} ${change.itemId} (${change.op})`);
      if (change.reason) {
        lines.push(`      ${change.reason}`);
      }
    }
  }

  return lines.join("\n");
}

function formatMarkdown(report: ReturnType<typeof diffBlueprints>): string {
  const lines = [
    `# Diff Report`,
    `**From:** ${report.baseVersion}`,
    `**To:** ${report.targetVersion}`,
    `**Generated:** ${report.timestamp}`,
    "",
    `## Summary`,
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Added | ${report.summary.added} |`,
    `| Removed | ${report.summary.removed} |`,
    `| Modified | ${report.summary.modified} |`,
    `| Reordered | ${report.summary.reordered} |`,
    "",
    `## Metadata`,
    `- **Base checksum:** \`${report.metadata.checksum_base}\``,
    `- **Target checksum:** \`${report.metadata.checksum_target}\``,
    `- **Compatible:** ${report.metadata.compatible ? "✅ Yes" : "❌ No"}`,
    "",
  ];

  if (report.changes.length === 0) {
    lines.push("**No changes detected.**");
    return lines.join("\n");
  }

  lines.push("## Changes");
  const byLayer = new Map<string, typeof report.changes>();
  for (const change of report.changes) {
    if (!byLayer.has(change.layer)) {
      byLayer.set(change.layer, []);
    }
    byLayer.get(change.layer)!.push(change);
  }

  const emojiIcons: Record<string, string> = {
    add: "➕",
    remove: "❌",
    modify: "🔄",
    reorder: "➡️",
  };

  for (const [layer, changes] of byLayer.entries()) {
    lines.push(`### ${layer}`);
    lines.push("");
    for (const change of changes) {
      const icon = emojiIcons[change.op] ?? "❓";
      lines.push(`${icon} **${change.itemId}** \`${change.op}\``);
      if (change.reason) {
        lines.push(`  - ${change.reason}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
