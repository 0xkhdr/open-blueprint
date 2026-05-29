import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { BlueprintAdapter } from "../index.js";
import type { BlueprintIR, Rule, Skill } from "../ir.js";
import { generateAgentsMD } from "./agents-md.js";

export class CopilotAdapter implements BlueprintAdapter {
  async parse(projectRoot: string): Promise<BlueprintIR> {
    const copilotDir = path.join(projectRoot, ".github", "copilot");

    // 1. Spatial Anchor
    let anchorPath = path.join(projectRoot, "copilot-instructions.md");
    if (!fs.existsSync(anchorPath)) {
      anchorPath = path.join(copilotDir, "instructions.md");
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

    // 2. Rules (Copilot focuses on rules)
    const rules: Rule[] = [];
    const ruleFiles = await fg(path.join(copilotDir, "rules", "*.md"), { onlyFiles: true });
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
    const skillFiles = await fg(path.join(copilotDir, "skills", "*.md"), { onlyFiles: true });
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
        source_backend: "copilot",
        target_backend: "copilot",
      },
    };
  }

  async render(ir: BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles: string[] = [];
    const copilotDir = path.join(projectRoot, ".github", "copilot");

    // Create directories
    fs.mkdirSync(path.join(copilotDir, "rules"), { recursive: true });
    fs.mkdirSync(path.join(copilotDir, "skills"), { recursive: true });

    // 1. Main instructions file (.github/copilot/instructions.md)
    const instructionsPath = path.join(copilotDir, "instructions.md");
    fs.writeFileSync(instructionsPath, ir.spatial_anchor.surface, "utf-8");
    writtenFiles.push(instructionsPath);

    // 1b. Root fallback for compatibility
    const rootInstructionsPath = path.join(projectRoot, "copilot-instructions.md");
    fs.writeFileSync(rootInstructionsPath, ir.spatial_anchor.surface, "utf-8");
    writtenFiles.push(rootInstructionsPath);

    // 2. Rules (Copilot-specific formatting)
    for (const rule of ir.rules) {
      const ruleFile = `${rule.id}.md`;
      const rulePath = path.join(copilotDir, "rules", ruleFile);

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

## Copilot Rule

This rule applies to: \`${rule.scope}\`

**Action:** ${rule.action}

${rule.rationale ? `**Why:** ${rule.rationale}` : ""}
`;

      fs.writeFileSync(rulePath, content, "utf-8");
      writtenFiles.push(rulePath);
    }

    // 3. Skills
    for (const skill of ir.skills) {
      const skillPath = path.join(copilotDir, "skills", `${skill.name.toLowerCase()}.prompt.md`);
      const content = `---
name: ${skill.name}
description: ${skill.description}
when_to_use: ${skill.when_to_use}
tools_required: ${JSON.stringify(skill.tools_required)}
---

## How to Use

${skill.when_to_use}

## Procedure

${skill.procedure}
`;

      fs.writeFileSync(skillPath, content, "utf-8");
      writtenFiles.push(skillPath);
    }

    // 4. AGENTS.md (universal output)
    const agentsMD = generateAgentsMD(ir);
    const agentsMDPath = path.join(projectRoot, "AGENTS.md");
    fs.writeFileSync(agentsMDPath, agentsMD, "utf-8");
    writtenFiles.push(agentsMDPath);

    // 5. Copilot-specific settings file
    let settingsYaml = `# GitHub Copilot Settings
# Generated: ${new Date().toISOString()}
# Blueprint Version: ${ir.version}
# Project: ${ir.spatial_anchor.project_name}

copilot:
  # Approval modes for Copilot suggestions
  approval_mode: ${ir.settings?.approval_mode || "auto"}

`;

    if (ir.settings?.model_config?.model) {
      settingsYaml += `  model: ${ir.settings.model_config.model}
`;
    }

    if (ir.settings?.cost_controls?.monthly_budget_usd) {
      settingsYaml += `  budget:
    monthly_usd: ${ir.settings.cost_controls.monthly_budget_usd}
`;
    }

    if (ir.settings?.safety_modes && ir.settings.safety_modes.length > 0) {
      settingsYaml += `  safety_modes:
`;
      for (const mode of ir.settings.safety_modes) {
        settingsYaml += `    - ${mode}
`;
      }
    }

    settingsYaml += `
# Rules enforcement
rules:
`;

    for (const rule of ir.rules) {
      const enforcement = rule.severity === "hard" ? "enforce" : "suggest";
      settingsYaml += `  ${rule.id}: ${enforcement}
`;
    }

    const settingsPath = path.join(copilotDir, "settings.yaml");
    fs.writeFileSync(settingsPath, settingsYaml, "utf-8");
    writtenFiles.push(settingsPath);

    return writtenFiles;
  }
}
