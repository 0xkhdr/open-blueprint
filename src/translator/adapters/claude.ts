import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { BlueprintAdapter } from "../index.js";
import type { BlueprintIR, Hook, Persona, Rule, Skill } from "../ir.js";

export class ClaudeAdapter implements BlueprintAdapter {
  async parse(projectRoot: string): Promise<BlueprintIR> {
    const claudeDir = path.join(projectRoot, ".claude");

    // 1. Spatial Anchor
    let anchorPath = path.join(projectRoot, "CLAUDE.md");
    if (!fs.existsSync(anchorPath)) {
      anchorPath = path.join(claudeDir, "CLAUDE.md");
    }

    let projectName = "unknown";
    let anchorContent = "";
    const conventions: string[] = [];

    if (fs.existsSync(anchorPath)) {
      anchorContent = fs.readFileSync(anchorPath, "utf-8");
      // Extract project name from the first H1
      const h1Match = anchorContent.match(/^#\s+(.+)$/m);
      if (h1Match?.[1]) {
        projectName = h1Match[1].trim();
      }

      // Extract conventions (bullet points in the file)
      const lines = anchorContent.split("\n");
      for (const line of lines) {
        if (line.trim().startsWith("- ")) {
          conventions.push(line.trim().substring(2));
        }
      }
    }

    // 2. Personas (Agents)
    const personas: Persona[] = [];
    const agentFiles = await fg(path.join(claudeDir, "agents", "*.md"), { onlyFiles: true });
    for (const file of agentFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const parsed = matter(content);
        const data = parsed.data;

        // Extract constraints (bullet points from markdown body)
        const constraints: string[] = [];
        const bodyLines = parsed.content.split("\n");
        let inConstraintsSection = false;
        for (const line of bodyLines) {
          if (line.toLowerCase().includes("## constraints")) {
            inConstraintsSection = true;
            continue;
          }
          if (inConstraintsSection && line.startsWith("#")) {
            inConstraintsSection = false;
          }
          if (inConstraintsSection && line.trim().startsWith("- ")) {
            constraints.push(line.trim().substring(2));
          }
        }

        // Fallback constraint extraction if no section was found
        if (constraints.length === 0) {
          for (const line of bodyLines) {
            if (line.trim().startsWith("- ")) {
              constraints.push(line.trim().substring(2));
            }
          }
        }

        personas.push({
          name: typeof data.name === "string" ? data.name : path.basename(file, ".md"),
          role: typeof data.role === "string" ? data.role : "",
          reasoning_style:
            typeof data.reasoning_style === "string" ? data.reasoning_style : "methodical",
          constraints,
          allowed_tools: Array.isArray(data.allowed_tools) ? data.allowed_tools : [],
        });
      } catch (_e) {
        // Ignore single file failures
      }
    }

    // 3. Rules
    const rules: Rule[] = [];
    const ruleFiles = await fg(path.join(claudeDir, "rules", "*.md"), { onlyFiles: true });
    for (const file of ruleFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const parsed = matter(content);
        const data = parsed.data;

        rules.push({
          id: path.basename(file, ".md"),
          scope: typeof data.scope === "string" ? data.scope : "**/*",
          severity: data.severity === "hard" ? "hard" : "soft",
          action: typeof data.action === "string" ? data.action : "",
          rationale: typeof data.rationale === "string" ? data.rationale : undefined,
          tags: Array.isArray(data.tags) ? data.tags : undefined,
        });
      } catch (_e) {
        // Ignore
      }
    }

    // 4. Skills
    const skills: Skill[] = [];
    const skillFiles = await fg(path.join(claudeDir, "skills", "*.md"), { onlyFiles: true });
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
        // Ignore
      }
    }

    // 5. Hooks
    const hooks: Hook[] = [];
    const hookFiles = await fg(path.join(claudeDir, "hooks", "*"), { onlyFiles: true });
    for (const file of hookFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const filename = path.basename(file);
        const isPre = filename.startsWith("pre_");
        hooks.push({
          event: isPre ? "pre_tool_use" : "post_tool_use",
          language: filename.endsWith(".js") ? "javascript" : "shell",
          stub: content,
        });
      } catch (_e) {
        // Ignore
      }
    }

    // 6. Meta (try to parse rule precedence from 04-meta.md if exists)
    const rulePrecedence: string[] = [];
    const metaPath = path.join(claudeDir, "rules", "04-meta.md");
    if (fs.existsSync(metaPath)) {
      try {
        const content = fs.readFileSync(metaPath, "utf-8");
        // Simple heuristic: search for markdown lists or mention of order
        const precedenceLines = content.split("\n");
        for (const line of precedenceLines) {
          if (line.trim().startsWith("- ") || line.trim().startsWith("1. ")) {
            const clean = line.replace(/^[-1-9.\s]+/, "").trim();
            if (clean?.includes(".md")) {
              rulePrecedence.push(clean);
            }
          }
        }
      } catch (_e) {
        // Ignore
      }
    }

    return {
      version: "1.0",
      spatial_anchor: {
        project_name: projectName,
        surface: anchorContent,
        temporal_anchor: "development",
        conventions,
      },
      personas,
      rules,
      skills,
      hooks,
      meta: {
        rule_precedence: rulePrecedence,
        conflict_resolution: "precedence-based",
        source_backend: "claude",
        target_backend: "claude",
      },
    };
  }

  async render(ir: BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles: string[] = [];
    const claudeDir = path.join(projectRoot, ".claude");

    // Create folders
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "rules"), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "skills"), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "hooks"), { recursive: true });

    // 1. Spatial Anchor
    const anchorPath = path.join(projectRoot, "CLAUDE.md");
    let anchorContent = `<!-- bp-generated:begin position -->\n# ${ir.spatial_anchor.project_name}\n\n`;
    if (ir.spatial_anchor.conventions.length > 0) {
      anchorContent += `## Project Conventions\n\n`;
      for (const conv of ir.spatial_anchor.conventions) {
        anchorContent += `- ${conv}\n`;
      }
    }
    anchorContent += `<!-- bp-generated:end position -->\n`;
    fs.writeFileSync(anchorPath, anchorContent, "utf-8");
    writtenFiles.push(anchorPath);

    // 2. Personas (Agents)
    for (const persona of ir.personas) {
      const agentPath = path.join(claudeDir, "agents", `${persona.name.toLowerCase()}.md`);
      let content = `---\n`;
      content += `name: ${persona.name}\n`;
      content += `role: ${persona.role}\n`;
      content += `reasoning_style: ${persona.reasoning_style}\n`;
      if (persona.allowed_tools && persona.allowed_tools.length > 0) {
        content += `allowed_tools: [${persona.allowed_tools.map((t) => `"${t}"`).join(", ")}]\n`;
      }
      content += `---\n\n`;
      content += `<!-- bp-generated:begin ${persona.name.toLowerCase()}-body -->\n`;
      content += `# ${persona.name} Agent\n\n`;
      if (persona.role) {
        content += `**Role:** ${persona.role}\n\n`;
      }
      if (persona.constraints.length > 0) {
        content += `## Constraints\n\n`;
        for (const c of persona.constraints) {
          content += `- ${c}\n`;
        }
      }
      content += `<!-- bp-generated:end ${persona.name.toLowerCase()}-body -->\n`;
      fs.writeFileSync(agentPath, content, "utf-8");
      writtenFiles.push(agentPath);
    }

    // 3. Rules
    for (const rule of ir.rules) {
      const rulePath = path.join(claudeDir, "rules", `${rule.id}.md`);
      let content = `---\n`;
      content += `scope: "${rule.scope}"\n`;
      content += `severity: ${rule.severity}\n`;
      content += `action: ${rule.action}\n`;
      if (rule.rationale) {
        content += `rationale: ${rule.rationale}\n`;
      }
      if (rule.tags && rule.tags.length > 0) {
        content += `tags: [${rule.tags.join(", ")}]\n`;
      }
      content += `---\n\n`;
      content += `# Rule ${rule.id}: ${rule.action}\n\n`;
      if (rule.rationale) {
        content += `**Rationale:** ${rule.rationale}\n\n`;
      }
      fs.writeFileSync(rulePath, content, "utf-8");
      writtenFiles.push(rulePath);
    }

    // 4. Skills
    for (const skill of ir.skills) {
      const skillPath = path.join(claudeDir, "skills", `${skill.name.toLowerCase()}.md`);
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

    // 5. Hooks
    for (const hook of ir.hooks) {
      const ext = hook.language === "javascript" ? "js" : "sh";
      const filename =
        hook.event === "pre_tool_use" ? `pre_tool_use.${ext}` : `post_tool_use.${ext}`;
      const hookPath = path.join(claudeDir, "hooks", filename);
      fs.writeFileSync(hookPath, hook.stub, "utf-8");
      writtenFiles.push(hookPath);
    }

    return writtenFiles;
  }
}
