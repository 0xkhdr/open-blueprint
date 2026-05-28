# Domain: Developer Experience
**Priority:** P3 · **Status:** ⚠️ PARTIAL — Interactive wizard done, VS Code + migration + dev server + docs missing · **Dependencies:** `09-PRODUCTION-HARDENING.md`
**Agent Boundary:** Interactive wizard exists. Your job is VS Code extension polish, migration assistant, dev server dashboard, and docs generator.

---

## 1. Current State (Verified from Repo)

Already implemented:
- ✅ `interactiveWizard()` in `src/cli/commands/init.ts` — 7-step wizard with Ink
- ✅ `bp migrate` command exists
- ✅ `bp dev` command exists
- ✅ `bp docs` command exists

**Missing:**
- ❌ VS Code extension (only LSP server in Production Hardening)
- ❌ Migration feature parity checker
- ❌ Dev server browser dashboard
- ❌ Docs auto-generator implementation

---

## 2. Implementation Tasks

### Task 10.1: VS Code Extension (Polish)
The LSP server is implemented in `09-PRODUCTION-HARDENING.md`. This task polishes the VS Code wrapper:

Create `editors/vscode/src/`:

**`tree-view.ts`:**
```typescript
import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";

export class BlueprintTreeProvider implements vscode.TreeDataProvider<BlueprintItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BlueprintItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: BlueprintItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BlueprintItem): Thenable<BlueprintItem[]> {
    if (!element) {
      return Promise.resolve([
        new BlueprintItem("Rules", vscode.TreeItemCollapsibleState.Collapsed, "rules"),
        new BlueprintItem("Skills", vscode.TreeItemCollapsibleState.Collapsed, "skills"),
        new BlueprintItem("Agents", vscode.TreeItemCollapsibleState.Collapsed, "agents"),
        new BlueprintItem("Settings", vscode.TreeItemCollapsibleState.None, "settings"),
      ]);
    }

    if (element.type === "rules") {
      return this.getRuleItems();
    }
    if (element.type === "skills") {
      return this.getSkillItems();
    }
    if (element.type === "agents") {
      return this.getAgentItems();
    }

    return Promise.resolve([]);
  }

  private async getRuleItems(): Promise<BlueprintItem[]> {
    const rulesDir = path.join(this.workspaceRoot, ".claude", "rules");
    if (!fs.existsSync(rulesDir)) return [];

    const files = fs.readdirSync(rulesDir).filter(f => f.endsWith(".md"));
    return files.map(f => {
      const item = new BlueprintItem(f, vscode.TreeItemCollapsibleState.None, "rule-file");
      item.command = {
        command: "vscode.open",
        title: "Open Rule",
        arguments: [vscode.Uri.file(path.join(rulesDir, f))],
      };
      return item;
    });
  }

  private async getSkillItems(): Promise<BlueprintItem[]> {
    const skillsDir = path.join(this.workspaceRoot, ".claude", "skills");
    if (!fs.existsSync(skillsDir)) return [];

    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith(".md"));
    return files.map(f => {
      const item = new BlueprintItem(f, vscode.TreeItemCollapsibleState.None, "skill-file");
      item.command = {
        command: "vscode.open",
        title: "Open Skill",
        arguments: [vscode.Uri.file(path.join(skillsDir, f))],
      };
      return item;
    });
  }

  private async getAgentItems(): Promise<BlueprintItem[]> {
    const agentsDir = path.join(this.workspaceRoot, ".claude", "agents");
    if (!fs.existsSync(agentsDir)) return [];

    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
    return files.map(f => {
      const item = new BlueprintItem(f, vscode.TreeItemCollapsibleState.None, "agent-file");
      item.command = {
        command: "vscode.open",
        title: "Open Agent",
        arguments: [vscode.Uri.file(path.join(agentsDir, f))],
      };
      return item;
    });
  }
}

export class BlueprintItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: string
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.description = this.type;
  }
}
```

**Update `extension.ts`:**
```typescript
import { BlueprintTreeProvider } from "./tree-view.js";

export function activate(context: vscode.ExtensionContext) {
  // ... existing LSP client setup ...

  // Register tree view
  const treeProvider = new BlueprintTreeProvider(vscode.workspace.workspaceFolders?.[0].uri.fsPath || "");
  vscode.window.registerTreeDataProvider("blueprintExplorer", treeProvider);

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand("blueprint.refreshExplorer", () => treeProvider.refresh())
  );
}
```

### Task 10.2: Migration Assistant
Create `src/dx/migrate.ts`:

```typescript
import type { BlueprintIR } from "../translator/ir.js";
import { parseBlueprint } from "../translator/index.js";

export interface MigrationPlan {
  source_backend: string;
  target_backend: string;
  steps: Array<{
    action: "translate" | "warn" | "manual" | "skip";
    source_file: string;
    target_file: string;
    confidence: number;
    note?: string;
  }>;
  warnings: string[];
  manual_steps: string[];
  feature_gaps: string[];
}

export interface FeatureParity {
  feature: string;
  source_supported: boolean;
  target_supported: boolean;
  mappable: boolean;
}

const FEATURE_MATRIX: Record<string, Record<string, boolean>> = {
  claude: {
    rules: true, skills: true, agents: true, hooks: true,
    settings: true, commands: true, mcp: true, teams: true, chains: true,
  },
  cursor: {
    rules: true, skills: false, agents: false, hooks: false,
    settings: true, commands: false, mcp: false, teams: false, chains: false,
  },
  codex: {
    rules: true, skills: true, agents: true, hooks: true,
    settings: true, commands: true, mcp: true, teams: true, chains: true,
  },
  pi: {
    rules: false, skills: true, agents: true, hooks: false,
    settings: true, commands: true, mcp: true, teams: true, chains: true,
  },
  kiro: {
    rules: false, skills: false, agents: false, hooks: false,
    settings: false, commands: false, mcp: false, teams: false, chains: false,
  },
  copilot: {
    rules: true, skills: false, agents: false, hooks: false,
    settings: false, commands: false, mcp: false, teams: false, chains: false,
  },
  gemini: {
    rules: true, skills: true, agents: true, hooks: false,
    settings: true, commands: true, mcp: true, teams: false, chains: false,
  },
  opendev: {
    rules: true, skills: true, agents: true, hooks: true,
    settings: true, commands: true, mcp: true, teams: true, chains: true,
  },
  generic: {
    rules: true, skills: true, agents: true, hooks: true,
    settings: true, commands: true, mcp: true, teams: true, chains: true,
  },
};

export async function generateMigrationPlan(
  sourceDir: string,
  from: string,
  to: string
): Promise<MigrationPlan> {
  const plan: MigrationPlan = {
    source_backend: from,
    target_backend: to,
    steps: [],
    warnings: [],
    manual_steps: [],
    feature_gaps: [],
  };

  // Check feature parity
  const sourceFeatures = FEATURE_MATRIX[from] || {};
  const targetFeatures = FEATURE_MATRIX[to] || {};

  for (const [feature, supported] of Object.entries(sourceFeatures)) {
    if (supported && !targetFeatures[feature]) {
      plan.feature_gaps.push(feature);
      plan.warnings.push(`${to} does not support '${feature}' — will be converted to comments or skipped`);
    }
  }

  // Parse source
  let ir: BlueprintIR;
  try {
    ir = await parseBlueprint(sourceDir, from);
  } catch (e) {
    throw new Error(`Failed to parse source blueprint: ${e}`);
  }

  // Generate steps for each layer
  if (ir.rules.length > 0) {
    if (targetFeatures.rules) {
      plan.steps.push({
        action: "translate",
        source_file: ".claude/rules/*.md",
        target_file: getTargetRulesPath(to),
        confidence: 0.95,
        note: `${ir.rules.length} rules will be translated`,
      });
    } else {
      plan.steps.push({
        action: "skip",
        source_file: ".claude/rules/*.md",
        target_file: "N/A",
        confidence: 1.0,
        note: `${to} does not support rules — skipping`,
      });
      plan.manual_steps.push("Manually port rules to target format");
    }
  }

  if (ir.skills.length > 0) {
    if (targetFeatures.skills) {
      plan.steps.push({
        action: "translate",
        source_file: ".claude/skills/*.md",
        target_file: getTargetSkillsPath(to),
        confidence: 0.9,
        note: `${ir.skills.length} skills will be translated`,
      });
    } else {
      plan.steps.push({
        action: "warn",
        source_file: ".claude/skills/*.md",
        target_file: "N/A",
        confidence: 0.5,
        note: `${to} does not support skills — will be converted to rule references`,
      });
    }
  }

  if (ir.personas.length > 0) {
    if (targetFeatures.agents) {
      plan.steps.push({
        action: "translate",
        source_file: ".claude/agents/*.md",
        target_file: getTargetAgentsPath(to),
        confidence: 0.85,
        note: `${ir.personas.length} agents will be translated`,
      });
    } else {
      plan.steps.push({
        action: "warn",
        source_file: ".claude/agents/*.md",
        target_file: "N/A",
        confidence: 0.3,
        note: `${to} does not support agents — will be converted to inline instructions`,
      });
    }
  }

  return plan;
}

export function generateMigrationReport(plan: MigrationPlan): string {
  let report = `# Migration Report: ${plan.source_backend} → ${plan.target_backend}\n\n`;
  report += `## Summary\n`;
  report += `- **Files to Translate:** ${plan.steps.filter(s => s.action === "translate").length}\n`;
  report += `- **Warnings:** ${plan.warnings.length}\n`;
  report += `- **Manual Steps Required:** ${plan.manual_steps.length}\n`;
  report += `- **Feature Gaps:** ${plan.feature_gaps.length}\n\n`;

  if (plan.feature_gaps.length > 0) {
    report += `## Feature Gaps\n`;
    report += `The following features from ${plan.source_backend} are not supported by ${plan.target_backend}:\n\n`;
    for (const gap of plan.feature_gaps) {
      report += `- **${gap}**\n`;
    }
    report += "\n";
  }

  report += `## Migration Steps\n`;
  report += "| Action | Source | Target | Confidence | Note |\n";
  report += "|--------|--------|--------|------------|------|\n";
  for (const step of plan.steps) {
    const icon = step.action === "translate" ? "✅" : step.action === "warn" ? "⚠️" : step.action === "skip" ? "⏭️" : "📝";
    report += `| ${icon} ${step.action} | ${step.source_file} | ${step.target_file} | ${(step.confidence * 100).toFixed(0)}% | ${step.note || ""} |\n`;
  }

  if (plan.warnings.length > 0) {
    report += `\n## Warnings\n`;
    for (const warning of plan.warnings) {
      report += `- ⚠️ ${warning}\n`;
    }
  }

  if (plan.manual_steps.length > 0) {
    report += `\n## Manual Steps\n`;
    for (let i = 0; i < plan.manual_steps.length; i++) {
      report += `${i + 1}. ${plan.manual_steps[i]}\n`;
    }
  }

  return report;
}

function getTargetRulesPath(backend: string): string {
  const paths: Record<string, string> = {
    claude: ".claude/rules/*.md",
    cursor: ".cursor/rules/*.md",
    codex: ".codex/rules/*.md",
    copilot: ".github/copilot/instructions.md",
    gemini: "gemini.md",
    generic: "AGENTS.md",
  };
  return paths[backend] || `${backend}/rules/*`;
}

function getTargetSkillsPath(backend: string): string {
  const paths: Record<string, string> = {
    claude: ".claude/skills/*.md",
    codex: ".codex/skills/*.md",
    pi: "pi/skills/*.ts",
  };
  return paths[backend] || `${backend}/skills/*`;
}

function getTargetAgentsPath(backend: string): string {
  const paths: Record<string, string> = {
    claude: ".claude/agents/*.md",
    codex: ".codex/agents/*.md",
    pi: "pi/teams.yaml",
  };
  return paths[backend] || `${backend}/agents/*`;
}
```

### Task 10.3: Dev Server Browser Dashboard
Create `src/dx/dev-server.ts`:

```typescript
import { serve } from "bun";
import * as fs from "node:fs";
import * as path from "node:path";
import chokidar from "chokidar"; // May need to add dependency

export interface DevServerState {
  project_name: string;
  backend: string;
  risk_tier: string;
  rules_count: number;
  skills_count: number;
  agents_count: number;
  validation_status: "passing" | "warning" | "error";
  last_validated: string;
  errors: Array<{ file: string; message: string; severity: string }>;
}

export async function startDevServer(projectRoot: string, port: number = 3456) {
  let state: DevServerState = {
    project_name: path.basename(projectRoot),
    backend: "unknown",
    risk_tier: "unknown",
    rules_count: 0,
    skills_count: 0,
    agents_count: 0,
    validation_status: "passing",
    last_validated: new Date().toISOString(),
    errors: [],
  };

  // File watcher
  const watcher = chokidar.watch(
    [path.join(projectRoot, ".claude/**/*.md"), path.join(projectRoot, ".bp.json")],
    { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 300 } }
  );

  watcher.on("change", async () => {
    state = await revalidate(projectRoot);
  });

  // HTTP server
  serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/") {
        return new Response(renderDashboard(state), {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.pathname === "/api/state") {
        return Response.json(state);
      }

      if (url.pathname === "/api/validate") {
        state = await revalidate(projectRoot);
        return Response.json({ status: "ok", state });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`🚀 Blueprint dev server running at http://localhost:${port}`);
}

async function revalidate(projectRoot: string): Promise<DevServerState> {
  // Run bp verify and parse output
  // This is a simplified version — actual implementation would use the validator directly
  return {
    project_name: path.basename(projectRoot),
    backend: "claude",
    risk_tier: "medium",
    rules_count: countFiles(path.join(projectRoot, ".claude/rules")),
    skills_count: countFiles(path.join(projectRoot, ".claude/skills")),
    agents_count: countFiles(path.join(projectRoot, ".claude/agents")),
    validation_status: "passing",
    last_validated: new Date().toISOString(),
    errors: [],
  };
}

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith(".md")).length;
}

function renderDashboard(state: DevServerState): string {
  const statusColor = state.validation_status === "passing" ? "#22c55e" : 
                      state.validation_status === "warning" ? "#f59e0b" : "#ef4444";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Blueprint Dashboard — ${state.project_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .subtitle { color: #94a3b8; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; }
    .card h3 { font-size: 0.875rem; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.5rem; }
    .card .value { font-size: 2rem; font-weight: 700; }
    .status { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 9999px; font-weight: 600; }
    .status-passing { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .status-warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .status-error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .errors { margin-top: 2rem; }
    .error-item { background: #1e293b; border-left: 4px solid #ef4444; padding: 1rem; margin-bottom: 0.5rem; border-radius: 0 8px 8px 0; }
    .refresh { position: fixed; bottom: 2rem; right: 2rem; background: #3b82f6; color: white; border: none; padding: 1rem 2rem; border-radius: 9999px; cursor: pointer; font-weight: 600; }
    .refresh:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏗️ ${state.project_name}</h1>
    <p class="subtitle">Blueprint Governance Dashboard · Backend: ${state.backend} · Risk: ${state.risk_tier}</p>

    <div class="grid">
      <div class="card">
        <h3>Validation Status</h3>
        <span class="status status-${state.validation_status}">
          ${state.validation_status === "passing" ? "✓" : state.validation_status === "warning" ? "⚠" : "✗"} 
          ${state.validation_status.toUpperCase()}
        </span>
      </div>
      <div class="card">
        <h3>Rules</h3>
        <div class="value">${state.rules_count}</div>
      </div>
      <div class="card">
        <h3>Skills</h3>
        <div class="value">${state.skills_count}</div>
      </div>
      <div class="card">
        <h3>Agents</h3>
        <div class="value">${state.agents_count}</div>
      </div>
    </div>

    ${state.errors.length > 0 ? `
    <div class="errors">
      <h2>Errors (${state.errors.length})</h2>
      ${state.errors.map(e => `
        <div class="error-item">
          <strong>${e.file}</strong><br>
          ${e.message}
        </div>
      `).join("")}
    </div>
    ` : ""}
  </div>

  <button class="refresh" onclick="location.reload()">🔄 Refresh</button>

  <script>
    // Auto-refresh every 5 seconds
    setInterval(() => fetch('/api/state').then(r => r.json()).then(s => {
      if (s.last_validated !== '${state.last_validated}') location.reload();
    }), 5000);
  </script>
</body>
</html>`;
}
```

### Task 10.4: Documentation Generator
Create `src/dx/docs.ts`:

```typescript
import type { BlueprintIR } from "../translator/ir.js";
import { parseBlueprint } from "../translator/index.js";

export async function generateDocs(projectRoot: string): Promise<string> {
  const ir = await parseBlueprint(projectRoot, "claude");
  return generateMarkdownDocs(ir);
}

export function generateMarkdownDocs(ir: BlueprintIR): string {
  let md = `# Governance Documentation: ${ir.spatial_anchor.project_name}\n\n`;
  md += `**Generated:** ${new Date().toISOString()} · **IR Version:** ${ir.meta?.source_backend || "2.0"}\n\n`;

  // Table of Contents
  md += "## Table of Contents\n\n";
  md += "1. [Project Overview](#overview)\n";
  md += "2. [Risk Assessment](#risk)\n";
  md += "3. [Agent Governance](#agents)\n";
  md += "4. [Rule Registry](#rules)\n";
  md += "5. [Skill Registry](#skills)\n";
  md += "6. [Compliance Mapping](#compliance)\n";
  md += "7. [Settings](#settings)\n";
  md += "8. [MCP Servers](#mcp)\n";
  md += "9. [Audit Trail](#audit)\n\n";

  // Overview
  md += "## Project Overview\n\n";
  md += `- **Name:** ${ir.spatial_anchor.project_name}\n`;
  md += `- **Position:** ${ir.spatial_anchor.position}\n`;
  md += `- **Entry Point:** ${ir.spatial_anchor.entry_point}\n`;
  md += `- **Primary Language:** ${ir.spatial_anchor.primary_language}\n`;
  md += `- **Primary Framework:** ${ir.spatial_anchor.primary_framework}\n`;
  md += `- **Test Command:** ${ir.spatial_anchor.test_command}\n\n`;

  // Risk Assessment
  md += "## Risk Assessment\n\n";
  if (ir.risk) {
    md += `- **Tier:** ${ir.risk.risk_tier}\n`;
    md += `- **Score:** ${ir.risk.risk_signals ? Object.values(ir.risk.risk_signals).filter(Boolean).length : 0}/5\n`;
    md += "- **Signals:**\n";
    for (const [key, value] of Object.entries(ir.risk.risk_signals || {})) {
      md += `  - ${key}: ${value ? "✅ Yes" : "❌ No"}\n`;
    }
    if (ir.risk.escalation_rules?.length) {
      md += "- **Escalation Rules:**\n";
      for (const rule of ir.risk.escalation_rules) {
        md += `  - ${rule}\n`;
      }
    }
  } else {
    md += "No risk assessment configured.\n";
  }
  md += "\n";

  // Agents
  md += "## Agent Governance\n\n";
  if (ir.personas.length > 0) {
    md += "| Name | Role | Reasoning Style | Allowed Tools |\n";
    md += "|------|------|-----------------|---------------|\n";
    for (const agent of ir.personas) {
      md += `| ${agent.name} | ${agent.role} | ${agent.reasoning_style} | ${agent.allowed_tools?.join(", ") || "All"} |\n`;
    }
  } else {
    md += "No agents configured.\n";
  }
  md += "\n";

  // Rules
  md += "## Rule Registry\n\n";
  if (ir.rules.length > 0) {
    md += "| ID | Scope | Severity | Action |\n";
    md += "|----|-------|----------|--------|\n";
    for (const rule of ir.rules) {
      md += `| ${rule.id} | \`${rule.scope}\` | ${rule.severity} | ${rule.action.substring(0, 60)}${rule.action.length > 60 ? "..." : ""} |\n`;
    }
  } else {
    md += "No rules configured.\n";
  }
  md += "\n";

  // Skills
  md += "## Skill Registry\n\n";
  if (ir.skills.length > 0) {
    md += "| Name | Description | Tools Required |\n";
    md += "|------|-------------|----------------|\n";
    for (const skill of ir.skills) {
      md += `| ${skill.name} | ${skill.description.substring(0, 60)}... | ${skill.tools_required?.join(", ") || "None"} |\n`;
    }
  } else {
    md += "No skills configured.\n";
  }
  md += "\n";

  // Compliance
  md += "## Compliance Mapping\n\n";
  if (ir.compliance) {
    md += `- **Frameworks:** ${ir.compliance.frameworks?.join(", ") || "None"}\n`;
    md += `- **Certified:** ${ir.compliance.certified ? "✅ Yes" : "❌ No"}\n`;
    if (ir.compliance.compliance_gaps?.length) {
      md += "- **Gaps:**\n";
      for (const gap of ir.compliance.compliance_gaps) {
        md += `  - ${gap.framework}: ${gap.description}\n`;
      }
    }
  } else {
    md += "No compliance mapping configured.\n";
  }
  md += "\n";

  // Settings
  md += "## Settings\n\n";
  if (ir.settings) {
    md += `- **Approval Mode:** ${ir.settings.approval_mode}\n`;
    md += `- **Safety Mode:** ${ir.settings.safety_mode}\n`;
    md += `- **Auto Verify:** ${ir.settings.auto_verify_on_init ? "✅ Yes" : "❌ No"}\n`;
    if (ir.settings.model_config) {
      md += `- **Model:** ${ir.settings.model_config.default_model || "Default"}\n`;
      md += `- **Temperature:** ${ir.settings.model_config.temperature}\n`;
    }
    if (ir.settings.cost_controls) {
      md += `- **Monthly Budget:** $${ir.settings.cost_controls.monthly_budget_usd}\n`;
      md += `- **Alert Threshold:** ${ir.settings.cost_controls.alert_threshold_percent}%\n`;
    }
  } else {
    md += "No settings configured.\n";
  }
  md += "\n";

  // MCP
  md += "## MCP Servers\n\n";
  if (ir.mcp_servers?.length) {
    md += "| Name | Endpoint | Risk Level | Auth Scope |\n";
    md += "|------|----------|------------|------------|\n";
    for (const server of ir.mcp_servers) {
      md += `| ${server.name} | ${server.endpoint || "N/A"} | ${server.risk_level} | ${server.auth_scope?.join(", ") || "None"} |\n`;
    }
  } else {
    md += "No MCP servers configured.\n";
  }
  md += "\n";

  // Audit
  md += "## Audit Trail\n\n";
  if (ir.audit) {
    md += `- **Enabled:** ${ir.audit.audit_enabled ? "✅ Yes" : "❌ No"}\n`;
    md += `- **Log Level:** ${ir.audit.log_level}\n`;
    md += `- **Retention:** ${ir.audit.retention_days} days\n`;
    md += `- **Correlation Format:** ${ir.audit.correlation_id_format}\n`;
  } else {
    md += "No audit configuration.\n";
  }

  return md;
}
```

---

## 3. Acceptance Criteria

- [ ] VS Code extension shows Blueprint tree view with rules, skills, agents
- [ ] Tree view refreshes on file changes
- [ ] `bp migrate --from claude --to cursor` generates plan with confidence scores
- [ ] Migration report shows feature gaps, warnings, manual steps
- [ ] Feature parity matrix accurate for all 10 backends
- [ ] `bp dev --watch` serves dashboard at localhost:3456
- [ ] Dashboard auto-refreshes every 5 seconds
- [ ] Dashboard shows validation status, rule/skill/agent counts
- [ ] `bp docs generate` produces comprehensive governance markdown
- [ ] Docs include: overview, risk, agents, rules, skills, compliance, settings, MCP, audit
- [ ] 60+ new tests, all passing
- [ ] Coverage for `src/dx/` and `editors/vscode/` ≥ 90%

---

## 4. Cross-References

| Concern | File | Status |
|---------|------|--------|
| LSP server implementation | `09-PRODUCTION-HARDENING.md` | ❌ Not started |
| IR schema for migration | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Backend adapters for migration targets | `02-BACKEND-EXPANSION.md` | ✅ Complete |
| Risk assessment in wizard | `03-DETECTOR-ENHANCEMENT.md` | ⚠️ Partial |
| Compliance frameworks in docs | `06-ENTERPRISE-GOVERNANCE.md` | ⚠️ Partial |
| Agent teams in wizard | `07-MULTIAGENT-MCP.md` | ⚠️ Partial |
| Telemetry in dev server | `08-OBSERVABILITY-COST.md` | ⚠️ Partial |

---

*Domain Spec: Developer Experience · open-blueprint v2.0*
