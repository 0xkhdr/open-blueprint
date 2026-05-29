import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { BackendConfig } from "../../../backends/registry.js";
import type { BlueprintAdapter } from "../../index.js";
import type { BlueprintIR, Rule, Skill } from "../../ir.js";
import { generateAgentsMD } from "../agents-md.js";

export abstract class MarkdownAdapter implements BlueprintAdapter {
  protected abstract config: BackendConfig;

  async parse(projectRoot: string): Promise<BlueprintIR> {
    const skillsDir = path.join(projectRoot, this.config.skillsPath);
    const ext = this.config.fileExtension ?? ".md";

    const rules: Rule[] = [];
    const ruleFiles = await fg(path.join(projectRoot, ".bp-rules", "*.md"), { onlyFiles: true });
    for (const file of ruleFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const parsed = matter(content);
        const data = parsed.data;
        rules.push({
          id: typeof data.id === "string" ? data.id : path.basename(file, ".md"),
          scope: typeof data.scope === "string" ? data.scope : "**",
          severity: data.severity === "soft" ? "soft" : "hard",
          action: typeof data.action === "string" ? data.action : "",
          rationale: typeof data.rationale === "string" ? data.rationale : undefined,
          tags: Array.isArray(data.tags) ? data.tags : undefined,
        });
      } catch {
        // Skip malformed files
      }
    }

    const skills: Skill[] = [];
    const glob = ext === ".prompt.md" ? "*.prompt.md" : `*${ext}`;
    const skillFiles = await fg(path.join(skillsDir, glob), { onlyFiles: true });
    for (const file of skillFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const parsed = matter(content);
        const data = parsed.data;
        skills.push({
          name: typeof data.name === "string" ? data.name : path.basename(file, ext),
          description: typeof data.description === "string" ? data.description : "",
          when_to_use: typeof data.when_to_use === "string" ? data.when_to_use : "",
          tools_required: Array.isArray(data.tools_required) ? data.tools_required : [],
          procedure: parsed.content.trim(),
        });
      } catch {
        // Skip malformed files
      }
    }

    return {
      version: "2.0",
      spatial_anchor: {
        project_name: path.basename(projectRoot),
        surface: "",
        temporal_anchor: new Date().toISOString(),
        conventions: [],
      },
      personas: [],
      rules,
      skills,
      hooks: [],
      meta: {
        rule_precedence: rules.map((r) => r.id),
        conflict_resolution: "precedence-based",
        source_backend: this.config.id,
        target_backend: this.config.id,
      },
    };
  }

  async render(ir: BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles: string[] = [];
    const ext = this.config.fileExtension ?? ".md";
    const skillsDir = path.join(projectRoot, this.config.skillsPath);

    fs.mkdirSync(skillsDir, { recursive: true });

    if (this.config.commandsPath) {
      const commandsDir = path.join(projectRoot, this.config.commandsPath);
      fs.mkdirSync(commandsDir, { recursive: true });
    }

    for (const skill of ir.skills) {
      const filename = `${skill.name.toLowerCase().replace(/\s+/g, "-")}${ext}`;
      const skillPath = path.join(skillsDir, filename);
      let content = `---\n`;
      content += `name: ${skill.name}\n`;
      content += `description: "${skill.description}"\n`;
      content += `when_to_use: "${skill.when_to_use}"\n`;
      if (skill.tools_required && skill.tools_required.length > 0) {
        content += `tools_required: [${skill.tools_required.map((t) => `"${t}"`).join(", ")}]\n`;
      }
      content += `---\n\n`;
      content += `${skill.procedure}\n`;
      fs.writeFileSync(skillPath, content, "utf-8");
      writtenFiles.push(skillPath);
    }

    const agentsMD = generateAgentsMD(ir);
    const agentsMDPath = path.join(projectRoot, "AGENTS.md");
    fs.writeFileSync(agentsMDPath, agentsMD, "utf-8");
    writtenFiles.push(agentsMDPath);

    return writtenFiles;
  }

  renderCommand(skill: Skill, workflowId: string): string {
    const ext = this.config.fileExtension ?? ".md";
    return `---\nname: ${skill.name}\ndescription: "${skill.description}"\n---\n\n${skill.procedure}\n`;
  }

  getSkillPath(projectRoot: string, filename: string): string {
    const ext = this.config.fileExtension ?? ".md";
    return path.join(projectRoot, this.config.skillsPath, `${filename}${ext}`);
  }
}
