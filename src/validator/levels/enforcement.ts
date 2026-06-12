import { startSpan } from "../../telemetry/tracer.js";
import type {
  LevelOutcome,
  LevelValidator,
  ValidationContext,
  ValidationLevel,
} from "../contracts.js";
import { validateEnforcementDetailed } from "../enforcement.js";

/** Level 3.5 — enforcement: executable rule `check` evaluation (static only). */
export class EnforcementLevel implements LevelValidator {
  readonly name = "enforcement";
  readonly skipOnStructuralFailure = true;

  enabledFor(requested: ValidationLevel): boolean {
    return requested === "enforcement" || requested === "all";
  }

  async runGlobal(ctx: ValidationContext): Promise<LevelOutcome> {
    const result = await startSpan("bp.validate.enforcement", () =>
      validateEnforcementDetailed(ctx.projectRoot, ctx.manifest, ctx.fingerprint)
    );
    return { errors: result.errors, enforcement: result.summary };
  }
}
