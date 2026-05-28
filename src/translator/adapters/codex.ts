import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { BlueprintAdapter } from "../index.js";
import type { BlueprintIR, Hook, Persona, Rule, Skill } from "../ir.js";
import { generateAgentsMD } from "./agents-md.js";

export class CodexAdapter implements BlueprintAdapter {
  async parse(projectRoot: string): Promise<BlueprintIR> {
    const codexDir = path.join(projectRoot, ".codex");

    // 1. Spatial Anchor
    let anchorPath = path.join(projectRoot, "CODEX.md");
    if (!fs.existsSync(anchorPath)) {
      anchorPath = path.join(codexDir, "CODEX.md");
    }

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

    // 2. Personas (Agents)
    const personas: Persona[] = [];
    const agentFiles = await fg(path.join(codexDir, "agents", "*.md"), { onlyFiles: true });
    for (const file of agentFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const parsed = matter(content);
        const data = parsed.data;

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
          allowed_tools:
            Array.isArray(data.allowed_tools) ? data.allowed_tools : undefined,
        });
      } catch {
        // Skip malformed files
      }
    }

    // 3. Rules
    const rules: Rule[] = [];
    const ruleFiles = await fg(path.join(codexDir, "rules", "*.md"), { onlyFiles: true });
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

    // 4. Skills
    const skills: Skill[] = [];
    const skillFiles = await fg(path.join(codexDir, "skills", "*.md"), { onlyFiles: true });
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

    // 5. Hooks
    const hooks: Hook[] = [];
    const hookFiles = await fg(path.join(codexDir, "hooks", "*"), { onlyFiles: true });
    for (const file of hookFiles) {
      try {
        const filename = path.basename(file);
        const ext = path.extname(filename);
        const eventMatch = filename.match(/^(pre_tool_use|post_tool_use)/);

        if (eventMatch) {
          const stub = fs.readFileSync(file, "utf-8");
          hooks.push({
            event: eventMatch[1] as "pre_tool_use" | "post_tool_use",
            language: ext === ".js" ? "javascript" : ext === ".ts" ? "typescript" : "javascript",
            stub,
          });
        }
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
      personas,
      rules,
      skills,
      hooks,
      meta: {
        rule_precedence: rules.map((r) => r.id),
        conflict_resolution: "precedence-based",
        source_backend: "codex",
        target_backend: "codex",
      },
    };
  }

  async render(ir: BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles: string[] = [];
    const codexDir = path.join(projectRoot, ".codex");

    // Create directories
    fs.mkdirSync(path.join(codexDir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(codexDir, "rules"), { recursive: true });
    fs.mkdirSync(path.join(codexDir, "skills"), { recursive: true });
    fs.mkdirSync(path.join(codexDir, "hooks"), { recursive: true });

    // 1. Spatial Anchor
    const codexMDPath = path.join(projectRoot, "CODEX.md");
    fs.writeFileSync(codexMDPath, ir.spatial_anchor.surface, "utf-8");
    writtenFiles.push(codexMDPath);

    // 2. Agents
    for (const persona of ir.personas) {
      const agentPath = path.join(codexDir, "agents", `${persona.name.toLowerCase()}.md`);
      let content = `---
name: ${persona.name}
role: ${persona.role}
reasoning_style: ${persona.reasoning_style}
`;

      if (persona.allowed_tools && persona.allowed_tools.length > 0) {
        content += `allowed_tools: ${JSON.stringify(persona.allowed_tools)}
`;
      }

      content += `---

## Constraints

`;
      for (const constraint of persona.constraints) {
        content += `- ${constraint}
`;
      }

      fs.writeFileSync(agentPath, content, "utf-8");
      writtenFiles.push(agentPath);
    }

    // 3. Rules
    for (const rule of ir.rules) {
      const ruleFile = `${rule.id}.md`;
      const rulePath = path.join(codexDir, "rules", ruleFile);

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

      // Map approval_mode from settings if rule is hard
      if (rule.severity === "hard" && ir.settings?.approval_mode) {
        content += `approval_mode: ${ir.settings.approval_mode}
`;
      }

      content += `---

## Rule Details

${rule.rationale || "No details provided"}
`;

      fs.writeFileSync(rulePath, content, "utf-8");
      writtenFiles.push(rulePath);
    }

    // 4. Skills
    for (const skill of ir.skills) {
      const skillPath = path.join(codexDir, "skills", `${skill.name.toLowerCase()}.md`);
      let content = `---
name: ${skill.name}
description: ${skill.description}
when_to_use: ${skill.when_to_use}
tools_required: ${JSON.stringify(skill.tools_required)}
---

## Procedure

${skill.procedure}
`;

      fs.writeFileSync(skillPath, content, "utf-8");
      writtenFiles.push(skillPath);
    }

    // 5. Hooks
    for (const hook of ir.hooks) {
      const hookExt = hook.language === "typescript" ? "ts" : "js";
      const hookPath = path.join(codexDir, "hooks", `${hook.event}.${hookExt}`);
      fs.writeFileSync(hookPath, hook.stub, "utf-8");
      writtenFiles.push(hookPath);
    }

    // 6. AGENTS.md (universal output)
    const agentsMD = generateAgentsMD(ir);
    const agentsMDPath = path.join(projectRoot, "AGENTS.md");
    fs.writeFileSync(agentsMDPath, agentsMD, "utf-8");
    writtenFiles.push(agentsMDPath);

    // 7. codex.md (backend-specific configuration)
    let codexMD = `# Codex Configuration

**Generated:** ${new Date().toISOString()}
**Blueprint Version:** ${ir.version}
**Project:** ${ir.spatial_anchor.project_name}

## Approval Modes

Mapped from blueprint severity levels:

`;

    if (ir.settings?.approval_mode) {
      const approvalMap: Record<string, string> = {
        auto: "Auto-approve all changes",
        confirm: "Require confirmation for changes",
        "read-only": "No changes allowed",
      };

      codexMD += `**Global Approval Mode:** ${ir.settings.approval_mode} - ${approvalMap[ir.settings.approval_mode] || "Unknown"}

`;
    }

    codexMD += `## Rules Approval Matrix

`;

    for (const rule of ir.rules) {
      const approval = rule.severity === "hard" ? "read-only" : "auto";
      codexMD += `- **${rule.action}** (${rule.id}): ${approval}
`;
    }

    const codexConfigPath = path.join(projectRoot, "codex.md");
    fs.writeFileSync(codexConfigPath, codexMD, "utf-8");
    writtenFiles.push(codexConfigPath);

    return writtenFiles;
  }
}
