import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { BlueprintAdapter } from "../index.js";
import type { BlueprintIR, Rule, Skill } from "../ir.js";
import { generateAgentsMD } from "./agents-md.js";

export class AntigravityAdapter implements BlueprintAdapter {
  async parse(projectRoot: string): Promise<BlueprintIR> {
    // 1. Spatial Anchor
    let anchorPath = path.join(projectRoot, "antigravity.md");

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
    const ruleFiles = await fg(path.join(projectRoot, "artifacts", "*.md"), { onlyFiles: true });
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
    const skillFiles = await fg(path.join(projectRoot, "capabilities", "*.md"), {
      onlyFiles: true,
    });
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
        source_backend: "antigravity",
        target_backend: "antigravity",
      },
    };
  }

  async render(ir: BlueprintIR, projectRoot: string): Promise<string[]> {
    const writtenFiles: string[] = [];

    // Create directories
    fs.mkdirSync(path.join(projectRoot, "artifacts"), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, "capabilities"), { recursive: true });

    // 1. Main antigravity.md file
    const antigravityPath = path.join(projectRoot, "antigravity.md");
    fs.writeFileSync(antigravityPath, ir.spatial_anchor.surface, "utf-8");
    writtenFiles.push(antigravityPath);

    // 2. Artifacts (Rules as artifacts for artifact governance)
    for (const rule of ir.rules) {
      const artifactFile = `${rule.id}.md`;
      const artifactPath = path.join(projectRoot, "artifacts", artifactFile);

      let content = `---
id: ${rule.id}
scope: ${rule.scope}
severity: ${rule.severity}
action: ${rule.action}
artifact_type: rule
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

## Artifact Governance

**Artifact ID:** \`${rule.id}\`
**Type:** Governance Rule
**Applies to:** \`${rule.scope}\`
**Level:** ${rule.severity === "hard" ? "Enforced" : "Advisory"}

**Directive:** ${rule.action}

${rule.rationale ? `**Justification:** ${rule.rationale}` : ""}
`;

      fs.writeFileSync(artifactPath, content, "utf-8");
      writtenFiles.push(artifactPath);
    }

    // 3. Capabilities (Skills)
    for (const skill of ir.skills) {
      const capabilityPath = path.join(projectRoot, "capabilities", `${skill.name.toLowerCase()}.md`);
      let content = `---
name: ${skill.name}
description: ${skill.description}
when_to_use: ${skill.when_to_use}
tools_required: ${JSON.stringify(skill.tools_required)}
artifact_type: capability
---

## Capability Definition

### Overview

${skill.description}

### When to Enable

${skill.when_to_use}

### How to Implement

${skill.procedure}

### Tools Required

${skill.tools_required && skill.tools_required.length > 0 ? skill.tools_required.map((t) => `- ${t}`).join("\n") : "None"}
`;

      fs.writeFileSync(capabilityPath, content, "utf-8");
      writtenFiles.push(capabilityPath);
    }

    // 4. AGENTS.md (universal output)
    const agentsMD = generateAgentsMD(ir);
    const agentsMDPath = path.join(projectRoot, "AGENTS.md");
    fs.writeFileSync(agentsMDPath, agentsMD, "utf-8");
    writtenFiles.push(agentsMDPath);

    // 5. workspace.yaml - Antigravity workspace configuration
    let workspaceYaml = `# Antigravity Workspace Configuration
# Generated: ${new Date().toISOString()}
# Blueprint Version: ${ir.version}
# Project: ${ir.spatial_anchor.project_name}

workspace:
  name: ${ir.spatial_anchor.project_name}
  version: "1.0"

# Artifact governance
artifacts:
  rules:
    count: ${ir.rules.length}
    enforced: ${ir.rules.filter((r) => r.severity === "hard").length}
    advisory: ${ir.rules.filter((r) => r.severity === "soft").length}

  capabilities:
    count: ${ir.skills.length}

# Parallel coordination settings
coordination:
  parallel_mode: ${ir.orchestration?.agent_chains?.some((c) => c.parallel_mode) ? "enabled" : "disabled"}
  teams: ${ir.orchestration?.agent_teams?.length || 0}
  chains: ${ir.orchestration?.agent_chains?.length || 0}
`;

    const workspacePath = path.join(projectRoot, "workspace.yaml");
    fs.writeFileSync(workspacePath, workspaceYaml, "utf-8");
    writtenFiles.push(workspacePath);

    return writtenFiles;
  }
}
