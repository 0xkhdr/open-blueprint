import { parseBlueprint } from "../translator/index.js";
import type { BlueprintIR } from "../translator/ir.js";

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

export const FEATURE_MATRIX: Record<string, Record<string, boolean>> = {
  claude: {
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
    settings: true,
    commands: true,
    mcp: true,
    teams: true,
    chains: true,
  },
  cursor: {
    rules: true,
    skills: false,
    agents: false,
    hooks: false,
    settings: true,
    commands: false,
    mcp: false,
    teams: false,
    chains: false,
  },
  codex: {
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
    settings: true,
    commands: true,
    mcp: true,
    teams: true,
    chains: true,
  },
  pi: {
    rules: false,
    skills: true,
    agents: true,
    hooks: false,
    settings: true,
    commands: true,
    mcp: true,
    teams: true,
    chains: true,
  },
  kiro: {
    rules: false,
    skills: false,
    agents: false,
    hooks: false,
    settings: false,
    commands: false,
    mcp: false,
    teams: false,
    chains: false,
  },
  copilot: {
    rules: true,
    skills: false,
    agents: false,
    hooks: false,
    settings: false,
    commands: false,
    mcp: false,
    teams: false,
    chains: false,
  },
  gemini: {
    rules: true,
    skills: true,
    agents: true,
    hooks: false,
    settings: true,
    commands: true,
    mcp: true,
    teams: false,
    chains: false,
  },
  opendev: {
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
    settings: true,
    commands: true,
    mcp: true,
    teams: true,
    chains: true,
  },
  antigravity: {
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
    settings: true,
    commands: true,
    mcp: true,
    teams: true,
    chains: true,
  },
  generic: {
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
    settings: true,
    commands: true,
    mcp: true,
    teams: true,
    chains: true,
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

  const sourceFeatures = FEATURE_MATRIX[from] || {};
  const targetFeatures = FEATURE_MATRIX[to] || {};

  for (const [feature, supported] of Object.entries(sourceFeatures)) {
    if (supported && !targetFeatures[feature]) {
      plan.feature_gaps.push(feature);
      plan.warnings.push(
        `${to} does not support '${feature}' — will be converted to comments or skipped`
      );
    }
  }

  let ir: BlueprintIR;
  try {
    ir = await parseBlueprint(sourceDir, from);
  } catch (e) {
    throw new Error(`Failed to parse source blueprint: ${e}`);
  }

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
  report += `- **Files to Translate:** ${plan.steps.filter((s) => s.action === "translate").length}\n`;
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
    const icon =
      step.action === "translate"
        ? "✅"
        : step.action === "warn"
          ? "⚠️"
          : step.action === "skip"
            ? "⏭️"
            : "📝";
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

export function getFeatureParityList(from: string, to: string): FeatureParity[] {
  const sourceFeatures = FEATURE_MATRIX[from] || {};
  const targetFeatures = FEATURE_MATRIX[to] || {};
  const allFeatures = new Set([...Object.keys(sourceFeatures), ...Object.keys(targetFeatures)]);

  return Array.from(allFeatures).map((feature) => ({
    feature,
    source_supported: sourceFeatures[feature] ?? false,
    target_supported: targetFeatures[feature] ?? false,
    mappable: (sourceFeatures[feature] ?? false) && (targetFeatures[feature] ?? false),
  }));
}

export function getTargetRulesPath(backend: string): string {
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

export function getTargetSkillsPath(backend: string): string {
  const paths: Record<string, string> = {
    claude: ".claude/skills/*.md",
    codex: ".codex/skills/*.md",
    pi: "pi/skills/*.ts",
  };
  return paths[backend] || `${backend}/skills/*`;
}

export function getTargetAgentsPath(backend: string): string {
  const paths: Record<string, string> = {
    claude: ".claude/agents/*.md",
    codex: ".codex/agents/*.md",
    pi: "pi/teams.yaml",
  };
  return paths[backend] || `${backend}/agents/*`;
}
