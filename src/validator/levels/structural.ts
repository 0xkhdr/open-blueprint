import { startSpan } from "../../telemetry/tracer.js";
import type { ValidationError } from "../../types/validation.js";
import type { LevelValidator, ValidationContext } from "../contracts.js";
import { validateStructuralBatch } from "../structural.js";

/**
 * Level 1 — structural: encoding, frontmatter, required fields, secrets.
 *
 * Always runs (every requested level needs structurally sound files) and is
 * the level whose errors short-circuit the deeper levels.
 */
export class StructuralLevel implements LevelValidator {
  readonly name = "structural";
  readonly skipOnStructuralFailure = false;
  readonly marksStructuralFailure = true;

  enabledFor(): boolean {
    return true;
  }

  runFileScoped(ctx: ValidationContext): Promise<ValidationError[]> {
    return startSpan("bp.validate.structural", () =>
      validateStructuralBatch(ctx.filesToValidate, ctx.manifest, {
        entropyScan: ctx.options.entropyScan === true,
      })
    );
  }
}
