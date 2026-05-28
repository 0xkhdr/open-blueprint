import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { BlueprintAdapter } from "../index.js";
import type { BlueprintIR, Skill } from "../ir.js";
import { generateAgentsMD } from "./agents-md.js";

export class OpenDevAdapter implements BlueprintAdapter {
  async parse(projectRoot: string): Promise<BlueprintIR> {
    const opendevDir = path.join(projectRoot, ".opendev");

    // Skills only — opendev doesn't support anchors, rules, agents, hooks
    const skills: Skill[] = [];
    const skillFiles = await fg(path.join(opendevDir, "skills", "*.md"), { onlyFiles: true });
    for (const file of skillFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const parsed = matter(content);
        const data = parsed.data;

        skills.push({
          name: typeof data.name === "string" ? data.name : path.basename(file, ".md"),
          description: typeof data.description === "string" ? data.description : "",
          when_to_use: typeof data.when_to_use === "string" ? data.when_to_use : "",
          tools_required: Array.isArray(data.tools_required) ? data.tools_required : [],
          procedure: parsed.content.trim(),
        });
      } catch (_e) {
        // Ignore unreadable files
      }
    }

    return {
      version: "2.0",
      spatial_anchor: {
        project_name: path.basename(projectRoot),
        surface: "",
        temporal_anchor: "development",
        conventions: [],
      },
      personas: [],
      rules: [],
      skills,
      hooks: [],
      meta: {
        rule_precedence: [],
        conflict_resolution: "precedence-based",
        source_backend: "opendev",
        target_backend: "opendev",
      },
    };
  }

  async render(ir: BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles: string[] = [];
    const skillsDir = path.join(projectRoot, ".opendev", "skills");

    fs.mkdirSync(skillsDir, { recursive: true });

    // Skills only
    for (const skill of ir.skills) {
      const skillPath = path.join(skillsDir, `${skill.name.toLowerCase().replace(/\s+/g, "-")}.md`);
      let content = `---\n`;
      content += `name: ${skill.name}\n`;
      content += `description: "${skill.description}"\n`;
      if (skill.when_to_use) {
        content += `when_to_use: "${skill.when_to_use}"\n`;
      }
      if (skill.tools_required && skill.tools_required.length > 0) {
        content += `tools_required: ${JSON.stringify(skill.tools_required)}\n`;
      }
      content += `---\n\n`;
      content += `${skill.procedure}\n`;
      fs.writeFileSync(skillPath, content, "utf-8");
      writtenFiles.push(skillPath);
    }

    // AGENTS.md (universal output)
    const agentsMD = generateAgentsMD(ir);
    const agentsMDPath = path.join(projectRoot, "AGENTS.md");
    fs.writeFileSync(agentsMDPath, agentsMD, "utf-8");
    writtenFiles.push(agentsMDPath);

    return writtenFiles;
  }
}
