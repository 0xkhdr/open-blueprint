import * as fs from "node:fs";
import * as path from "node:path";
import type { Skill } from "../../ir.js";
import { MarkdownAdapter } from "./MarkdownAdapter.js";

export abstract class TomlCommandAdapter extends MarkdownAdapter {
  override renderCommand(skill: Skill, workflowId: string): string {
    return `[command]
name = "/openspec-${workflowId}"
description = "${skill.description.replace(/"/g, '\\"')}"

[body]
content = """
${skill.procedure}
"""
`;
  }

  override async render(ir: import("../../ir.js").BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles = await super.render(ir, projectRoot);

    if (this.config.commandsPath) {
      const commandsDir = path.join(projectRoot, this.config.commandsPath);
      fs.mkdirSync(commandsDir, { recursive: true });

      for (const skill of ir.skills) {
        const filename = `${skill.name.toLowerCase().replace(/\s+/g, "-")}.toml`;
        const cmdPath = path.join(commandsDir, filename);
        const content = this.renderCommand(skill, skill.name.toLowerCase().replace(/\s+/g, "-"));
        fs.writeFileSync(cmdPath, content, "utf-8");
        writtenFiles.push(cmdPath);
      }
    }

    return writtenFiles;
  }
}
