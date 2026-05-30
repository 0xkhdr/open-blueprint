import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import matter from "gray-matter";
import { type BackendConfig, getBackend, listBackendIds } from "../../backends/registry.js";
import type { ValidationError } from "../structural.js";

export interface BackendValidationRule {
  id: string;
  description: string;
  severity: "error" | "warning" | "info";
  appliesTo: string[] | "all";
  check: (projectRoot: string, backends: string[]) => ValidationError[];
}

function makeError(
  file: string,
  type: string,
  severity: ValidationError["severity"],
  message: string,
  resolution: string
): ValidationError {
  return { file, type, severity, message, resolution };
}

export const BACKEND_RULES: BackendValidationRule[] = [
  {
    id: "skill-only-no-commands",
    description: "Skill-only backends must not have command files",
    severity: "error",
    appliesTo: ["kimi", "trae", "forgecode"],
    check(projectRoot, backends) {
      const errors: ValidationError[] = [];
      for (const id of backends) {
        let config: BackendConfig;
        try {
          config = getBackend(id);
        } catch {
          continue;
        }
        if (config.supportsCommands) continue;
        // Derive the backend root dir from skillsPath (parent of skills subdir)
        const skillsDir = path.join(projectRoot, config.skillsPath);
        const backendRoot = path.dirname(skillsDir);
        const possibleCmdDir = path.join(backendRoot, "commands");
        if (fs.existsSync(possibleCmdDir)) {
          errors.push(
            makeError(
              possibleCmdDir,
              "SKILL_ONLY_BACKEND_HAS_COMMANDS",
              "error",
              `Skill-only backend "${id}" must not have command files at ${path.relative(projectRoot, possibleCmdDir)}`,
              `Remove the commands directory or reconfigure the backend`
            )
          );
        }
      }
      return errors;
    },
  },

  {
    id: "toml-command-format",
    description: "TOML backends must have syntactically valid TOML command files",
    severity: "error",
    appliesTo: ["gemini", "qwen"],
    check(projectRoot, backends) {
      const errors: ValidationError[] = [];
      for (const id of backends) {
        let config: BackendConfig;
        try {
          config = getBackend(id);
        } catch {
          continue;
        }
        if (config.fileExtension !== ".toml" || !config.commandsPath) continue;
        const cmdDir = path.join(projectRoot, config.commandsPath);
        if (!fs.existsSync(cmdDir)) continue;
        const tomlFiles = fs.readdirSync(cmdDir).filter((f) => f.endsWith(".toml"));
        for (const tomlFile of tomlFiles) {
          const filePath = path.join(cmdDir, tomlFile);
          const content = fs.readFileSync(filePath, "utf-8");
          // Basic TOML syntax check: look for obviously malformed content
          const hasUnclosedBracket = /^\s*\[[^\]]*$(?!.*\])/m.test(content);
          if (hasUnclosedBracket) {
            errors.push(
              makeError(
                filePath,
                "INVALID_TOML_SYNTAX",
                "error",
                `TOML file "${tomlFile}" for backend "${id}" has a syntax error (unclosed bracket)`,
                `Fix the TOML syntax in ${filePath}`
              )
            );
          }
        }
      }
      return errors;
    },
  },

  {
    id: "codex-global-path",
    description: "Codex global path must exist and be writable",
    severity: "warning",
    appliesTo: ["codex"],
    check(_projectRoot, backends) {
      if (!backends.includes("codex")) return [];
      const errors: ValidationError[] = [];
      let config: BackendConfig;
      try {
        config = getBackend("codex");
      } catch {
        return [];
      }

      const envVal = config.globalHomeEnv ? process.env[config.globalHomeEnv] : undefined;
      const globalPath = envVal
        ? path.join(envVal, "prompts")
        : (config.fallbackGlobalPath ?? "~/.codex/prompts").replace(/^~/, os.homedir());

      if (!fs.existsSync(globalPath)) {
        errors.push(
          makeError(
            globalPath,
            "CODEX_GLOBAL_PATH_MISSING",
            "warning",
            `Codex global commands path does not exist: ${globalPath}`,
            `Create ${globalPath} or set $CODEX_HOME to a writable directory`
          )
        );
      } else {
        try {
          fs.accessSync(globalPath, fs.constants.W_OK);
        } catch {
          errors.push(
            makeError(
              globalPath,
              "CODEX_GLOBAL_PATH_NOT_WRITABLE",
              "warning",
              `Codex global commands path is not writable: ${globalPath}`,
              `Fix permissions on ${globalPath}`
            )
          );
        }
      }
      return errors;
    },
  },

  {
    id: "github-copilot-ide-only",
    description: "GitHub Copilot commands require an IDE extension",
    severity: "warning",
    appliesTo: ["github-copilot"],
    check(projectRoot, backends) {
      if (!backends.includes("github-copilot")) return [];
      return [
        makeError(
          projectRoot,
          "COPILOT_IDE_ONLY",
          "warning",
          "GitHub Copilot commands require an IDE extension (VS Code, JetBrains, Visual Studio). Not available in Copilot CLI.",
          "Install the GitHub Copilot IDE extension to use generated command files"
        ),
      ];
    },
  },

  {
    id: "multi-backend-no-conflicts",
    description: "No two backends should have the same rule ID with conflicting severity",
    severity: "error",
    appliesTo: "all",
    check(projectRoot, backends) {
      const errors: ValidationError[] = [];
      const rulesBySeverity: Map<string, Map<string, string>> = new Map();

      for (const id of backends) {
        let config: BackendConfig;
        try {
          config = getBackend(id);
        } catch {
          continue;
        }
        const skillsDir = path.join(projectRoot, config.skillsPath);
        const rulesDir = path.join(path.dirname(skillsDir), "rules");
        if (!fs.existsSync(rulesDir)) continue;
        const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
        for (const ruleFile of ruleFiles) {
          const ruleId = ruleFile.replace(/\.md$/, "");
          try {
            const content = fs.readFileSync(path.join(rulesDir, ruleFile), "utf-8");
            const parsed = matter(content);
            const severity = parsed.data?.severity;
            if (typeof severity !== "string") continue;
            let entry = rulesBySeverity.get(ruleId);
            if (!entry) {
              entry = new Map();
              rulesBySeverity.set(ruleId, entry);
            }
            for (const [existingBackend, existingSeverity] of entry) {
              if (existingSeverity !== severity) {
                errors.push(
                  makeError(
                    path.join(rulesDir, ruleFile),
                    "MULTI_BACKEND_RULE_CONFLICT",
                    "error",
                    `Rule "${ruleId}" has conflicting severity: "${existingSeverity}" (${existingBackend}) vs "${severity}" (${id})`,
                    `Align severity of rule "${ruleId}" across all backends`
                  )
                );
              }
            }
            entry.set(id, severity);
          } catch {
            // Skip
          }
        }
      }
      return errors;
    },
  },

  {
    id: "backend-presence-check",
    description: "Backends in config must have files; files must be in config",
    severity: "error",
    appliesTo: "all",
    check(projectRoot, backends) {
      const errors: ValidationError[] = [];
      const backendsSet = new Set(backends);

      // Backend in config but files missing
      for (const id of backends) {
        let config: BackendConfig;
        try {
          config = getBackend(id);
        } catch {
          continue;
        }
        const skillsDir = path.join(projectRoot, config.skillsPath);
        if (!fs.existsSync(skillsDir)) {
          errors.push(
            makeError(
              skillsDir,
              "BACKEND_NOT_SCAFFOLDED",
              "error",
              `Backend "${id}" is configured in .bp.json but skills directory is missing: ${config.skillsPath}`,
              `Run 'bp init --tools ${id}' to scaffold the backend`
            )
          );
        }
      }

      // Backend files exist but not in config — check common backend dirs
      for (const id of listBackendIds()) {
        if (backendsSet.has(id)) continue;
        let config: BackendConfig;
        try {
          config = getBackend(id);
        } catch {
          continue;
        }
        const skillsDir = path.join(projectRoot, config.skillsPath);
        if (fs.existsSync(skillsDir)) {
          errors.push(
            makeError(
              skillsDir,
              "ORPHANED_BACKEND_FILES",
              "warning",
              `Backend "${id}" files found at ${config.skillsPath} but "${id}" is not in .bp.json backends`,
              `Add "${id}" to backends in .bp.json or remove the directory`
            )
          );
        }
      }

      return errors;
    },
  },
];

export function runBackendRules(projectRoot: string, backends: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const rule of BACKEND_RULES) {
    const applies = rule.appliesTo === "all" || rule.appliesTo.some((id) => backends.includes(id));
    if (!applies) continue;
    try {
      errors.push(...rule.check(projectRoot, backends));
    } catch {
      // Skip failing rules
    }
  }
  return errors;
}
