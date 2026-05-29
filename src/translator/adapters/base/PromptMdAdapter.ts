import * as fs from "node:fs";
import * as path from "node:path";
import { MarkdownAdapter } from "./MarkdownAdapter.js";

export abstract class PromptMdAdapter extends MarkdownAdapter {
  override getSkillPath(projectRoot: string, filename: string): string {
    return path.join(projectRoot, this.config.skillsPath, `${filename}.prompt.md`);
  }

  override async render(ir: import("../../ir.js").BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles: string[] = [];
    const skillsDir = path.join(projectRoot, this.config.skillsPath);
    fs.mkdirSync(skillsDir, { recursive: true });

    if (this.config.commandsPath) {
      fs.mkdirSync(path.join(projectRoot, this.config.commandsPath), { recursive: true });
    }

    for (const skill of ir.skills) {
      const filename = `${skill.name.toLowerCase().replace(/\s+/g, "-")}.prompt.md`;
      const skillPath = path.join(skillsDir, filename);
      let content = `---\nname: ${skill.name}\ndescription: "${skill.description}"\n---\n\n${skill.procedure}\n`;
      fs.writeFileSync(skillPath, content, "utf-8");
      writtenFiles.push(skillPath);
    }

    const { generateAgentsMD } = await import("../agents-md.js");
    const agentsMD = generateAgentsMD(ir);
    fs.writeFileSync(path.join(projectRoot, "AGENTS.md"), agentsMD, "utf-8");
    writtenFiles.push(path.join(projectRoot, "AGENTS.md"));

    return writtenFiles;
  }
}
