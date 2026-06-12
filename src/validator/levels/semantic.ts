import { startSpan } from "../../telemetry/tracer.js";
import type { ValidationError } from "../../types/validation.js";
import type {
  LevelOutcome,
  LevelValidator,
  ValidationContext,
  ValidationLevel,
} from "../contracts.js";
import { validateSemantic } from "../semantic.js";
import { validateSkills } from "../skills.js";

/**
 * Level 2 — semantic: scopes, references, budgets (per file, cached) plus
 * skill schema/collision checks (global: name collisions are cross-file, so
 * they bypass the per-file cache).
 */
export class SemanticLevel implements LevelValidator {
  readonly name = "semantic";
  readonly skipOnStructuralFailure = true;

  enabledFor(requested: ValidationLevel): boolean {
    return requested === "semantic" || requested === "all";
  }

  runFileScoped(ctx: ValidationContext): Promise<ValidationError[]> {
    return startSpan("bp.validate.semantic", () =>
      validateSemantic(ctx.filesToValidate, {
        projectRoot: ctx.projectRoot,
        manifest: ctx.manifest,
      })
    );
  }

  async runGlobal(ctx: ValidationContext): Promise<LevelOutcome> {
    const errors = await startSpan("bp.validate.skills", () =>
      validateSkills(ctx.projectRoot, ctx.manifest)
    );
    return { errors };
  }
}
