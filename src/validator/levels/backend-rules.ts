import * as path from "node:path";
import type { ValidationError } from "../../types/validation.js";
import type {
  LevelOutcome,
  LevelValidator,
  ValidationContext,
  ValidationLevel,
} from "../contracts.js";
import { runBackendRules } from "../rules/backend-rules.js";

/**
 * Backend-specific validation rules plus workspace blueprint coverage —
 * both only apply when a `.bp.json` project config names backends.
 *
 * Registered as its own level (it runs at the logical level but, unlike
 * `LogicalLevel`, is not skipped on structural failure — preserving the
 * pre-refactor pipeline behavior).
 */
export class BackendRulesLevel implements LevelValidator {
  readonly name = "backend-rules";
  readonly skipOnStructuralFailure = false;

  enabledFor(requested: ValidationLevel): boolean {
    return requested === "logical" || requested === "all";
  }

  async runGlobal(ctx: ValidationContext): Promise<LevelOutcome> {
    const errors: ValidationError[] = [];
    const { loadProjectConfig } = await import("../../config/project.js");
    const projectConfig = loadProjectConfig(ctx.projectRoot);
    if (!projectConfig) return { errors };

    const backends =
      projectConfig.backends ?? (projectConfig.backend ? [projectConfig.backend] : []);
    if (backends.length > 0) {
      errors.push(...runBackendRules(ctx.projectRoot, backends));
    }

    // Workspace blueprint coverage check
    if (ctx.fingerprint?.workspacePackages && ctx.fingerprint.workspacePackages.length > 0) {
      for (const pkg of ctx.fingerprint.workspacePackages) {
        const pkgDir = path.join(ctx.projectRoot, pkg.replace(/\*\*?$/, "").replace(/\*/g, ""));
        const hasBlueprint = ctx.files.some((f) => f.startsWith(pkgDir));
        if (!hasBlueprint) {
          errors.push({
            file: ctx.projectRoot,
            type: "MISSING_WORKSPACE_BLUEPRINT",
            severity: "warning",
            message: `Workspace package "${pkg}" has no blueprint coverage`,
            resolution: `Run \`bp init --backends ${backends[0] ?? "claude"}\` in ${pkg} to scaffold blueprint`,
          });
        }
      }
    }

    return { errors };
  }
}
