import * as fs from "node:fs";
import * as path from "node:path";
import type { BackendConfig } from "../../../backends/registry.js";
import { CommandSyntaxAdapter } from "../../../backends/syntax.js";
import type { BlueprintAdapter } from "../../index.js";
import type { BlueprintIR, Skill } from "../../ir.js";
import { generateAgentsMD } from "../agents-md.js";

export abstract class SkillOnlyAdapter implements BlueprintAdapter {
  protected abstract config: BackendConfig;
  private syntaxAdapter = new CommandSyntaxAdapter();

  renderCommand(_skill: Skill): never {
    throw new Error(
      `Backend "${this.config.id}" does not support command files (skill-only backend)`
    );
  }

  renderSkill(skill: Skill, workflowId: string): string {
    const invocation = this.syntaxAdapter.getInvocation(this.config.id, workflowId);
    return `---
name: ${skill.name}
description: "${skill.description}"
when_to_use: "${skill.when_to_use}"
---

${skill.procedure}

## Usage

Invoke this skill with: \`${invocation}\`
`;
  }

  async parse(projectRoot: string): Promise<BlueprintIR> {
    const skillsDir = path.join(projectRoot, this.config.skillsPath);
    const skills: Skill[] = [];

    if (fs.existsSync(skillsDir)) {
      const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
      const matter = (await import("gray-matter")).default;
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(skillsDir, file), "utf-8");
          const parsed = matter(content);
          const data = parsed.data;
          skills.push({
            name: typeof data.name === "string" ? data.name : path.basename(file, ".md"),
            description: typeof data.description === "string" ? data.description : "",
            when_to_use: typeof data.when_to_use === "string" ? data.when_to_use : "",
            tools_required: Array.isArray(data.tools_required) ? data.tools_required : [],
            procedure: parsed.content.trim(),
          });
        } catch {
          // Skip
        }
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
      rules: [],
      skills,
      hooks: [],
      meta: {
        rule_precedence: [],
        conflict_resolution: "precedence-based",
        source_backend: this.config.id,
        target_backend: this.config.id,
      },
    };
  }

  async render(ir: BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles: string[] = [];
    const skillsDir = path.join(projectRoot, this.config.skillsPath);
    fs.mkdirSync(skillsDir, { recursive: true });

    for (const skill of ir.skills) {
      const workflowId = skill.name.toLowerCase().replace(/\s+/g, "-");
      const filename = `${workflowId}.md`;
      const skillPath = path.join(skillsDir, filename);
      const content = this.renderSkill(skill, workflowId);
      fs.writeFileSync(skillPath, content, "utf-8");
      writtenFiles.push(skillPath);
    }

    const agentsMD = generateAgentsMD(ir);
    fs.writeFileSync(path.join(projectRoot, "AGENTS.md"), agentsMD, "utf-8");
    writtenFiles.push(path.join(projectRoot, "AGENTS.md"));

    return writtenFiles;
  }
}
