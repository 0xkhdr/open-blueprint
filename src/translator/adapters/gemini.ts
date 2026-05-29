import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import { CommandSyntaxAdapter } from "../../backends/syntax.js";
import type { BlueprintAdapter } from "../index.js";
import type { BlueprintIR, Rule, Skill } from "../ir.js";
import { generateAgentsMD } from "./agents-md.js";

const syntaxAdapter = new CommandSyntaxAdapter();

export class GeminiAdapter implements BlueprintAdapter {
  async parse(projectRoot: string): Promise<BlueprintIR> {
    // 1. Spatial Anchor
    const anchorPath = path.join(projectRoot, "gemini.md");

    let projectName = "unknown";
    let anchorContent = "";
    const conventions: string[] = [];

    if (fs.existsSync(anchorPath)) {
      anchorContent = fs.readFileSync(anchorPath, "utf-8");
      const h1Match = anchorContent.match(/^#\s+(.+)$/m);
      if (h1Match?.[1]) {
        projectName = h1Match[1].trim();
      }

      const lines = anchorContent.split("\n");
      for (const line of lines) {
        if (line.trim().startsWith("- ")) {
          conventions.push(line.trim().substring(2));
        }
      }
    }

    // 2. Rules
    const rules: Rule[] = [];
    const ruleFiles = await fg(path.join(projectRoot, "rules", "*.md"), { onlyFiles: true });
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

    // 3. Skills
    const skills: Skill[] = [];
    const skillFiles = await fg(path.join(projectRoot, "skills", "*.md"), { onlyFiles: true });
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
          procedure: parsed.content || "",
        });
      } catch {
        // Skip malformed files
      }
    }

    return {
      version: "2.0",
      spatial_anchor: {
        project_name: projectName,
        surface: anchorContent,
        temporal_anchor: new Date().toISOString(),
        conventions,
      },
      personas: [],
      rules,
      skills,
      hooks: [],
      meta: {
        rule_precedence: rules.map((r) => r.id),
        conflict_resolution: "precedence-based",
        source_backend: "gemini",
        target_backend: "gemini",
      },
    };
  }

  async render(ir: BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles: string[] = [];

    // Create directories
    fs.mkdirSync(path.join(projectRoot, "rules"), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, "skills"), { recursive: true });

    // 1. Main gemini.md file
    const geminiPath = path.join(projectRoot, "gemini.md");
    fs.writeFileSync(geminiPath, ir.spatial_anchor.surface, "utf-8");
    writtenFiles.push(geminiPath);

    // 2. Rules
    for (const rule of ir.rules) {
      const ruleFile = `${rule.id}.md`;
      const rulePath = path.join(projectRoot, "rules", ruleFile);

      let content = `---
id: ${rule.id}
scope: ${rule.scope}
severity: ${rule.severity}
action: ${rule.action}
`;

      if (rule.rationale) {
        content += `rationale: ${rule.rationale}
`;
      }

      if (rule.tags && rule.tags.length > 0) {
        content += `tags: ${JSON.stringify(rule.tags)}
`;
      }

      content += `---

## Gemini Rule

**Applies to:** \`${rule.scope}\`

**Action:** ${rule.action}

${rule.rationale ? `**Reason:** ${rule.rationale}` : ""}
`;

      fs.writeFileSync(rulePath, content, "utf-8");
      writtenFiles.push(rulePath);
    }

    // 3. Skills
    for (const skill of ir.skills) {
      const skillPath = path.join(projectRoot, "skills", `${skill.name.toLowerCase()}.md`);
      const content = `---
name: ${skill.name}
description: ${skill.description}
when_to_use: ${skill.when_to_use}
tools_required: ${JSON.stringify(skill.tools_required)}
---

## Capability

${skill.description}

## When to Use

${skill.when_to_use}

## How

${skill.procedure}
`;

      fs.writeFileSync(skillPath, content, "utf-8");
      writtenFiles.push(skillPath);
    }

    // 4. TOML command files (.gemini/commands/)
    const commandsDir = path.join(projectRoot, ".gemini", "commands");
    fs.mkdirSync(commandsDir, { recursive: true });
    for (const skill of ir.skills) {
      const workflowId = skill.name.toLowerCase().replace(/\s+/g, "-");
      const invocation = syntaxAdapter.getInvocation("gemini", workflowId);
      const tomlContent = `[command]
name = "${invocation}"
description = "${skill.description.replace(/"/g, '\\"')}"

[body]
content = """
${skill.procedure}
"""
`;
      const cmdPath = path.join(commandsDir, `${workflowId}.toml`);
      fs.writeFileSync(cmdPath, tomlContent, "utf-8");
      writtenFiles.push(cmdPath);
    }

    // 5. AGENTS.md (universal output)
    const agentsMD = generateAgentsMD(ir);
    const agentsMDPath = path.join(projectRoot, "AGENTS.md");
    fs.writeFileSync(agentsMDPath, agentsMD, "utf-8");
    writtenFiles.push(agentsMDPath);

    return writtenFiles;
  }
}
