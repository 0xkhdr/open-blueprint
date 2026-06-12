import { startSpan } from "../../telemetry/tracer.js";
import type {
  LevelOutcome,
  LevelValidator,
  ValidationContext,
  ValidationLevel,
} from "../contracts.js";
import { validateLogical } from "../logical.js";

/** Level 3 — logical: rule conflicts/contradictions, global across all rules. */
export class LogicalLevel implements LevelValidator {
  readonly name = "logical";
  readonly skipOnStructuralFailure = true;

  enabledFor(requested: ValidationLevel): boolean {
    return requested === "logical" || requested === "all";
  }

  async runGlobal(ctx: ValidationContext): Promise<LevelOutcome> {
    const errors = await startSpan("bp.validate.logical", () =>
      validateLogical(ctx.files, { projectRoot: ctx.projectRoot })
    );
    return { errors };
  }
}
