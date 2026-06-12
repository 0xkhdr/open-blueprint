import { startSpan } from "../../telemetry/tracer.js";
import type { ValidationError } from "../../types/validation.js";
import type {
  LevelOutcome,
  LevelValidator,
  ValidationContext,
  ValidationLevel,
} from "../contracts.js";
import { validateDrift } from "../drift.js";
import { validatePackIntegrity } from "../pack-integrity.js";

/**
 * Level 4 — drift: fingerprint delta against the repo plus installed-pack
 * integrity. Runs even after structural failures (drift is observational).
 */
export class DriftLevel implements LevelValidator {
  readonly name = "drift";
  readonly skipOnStructuralFailure = false;

  enabledFor(requested: ValidationLevel): boolean {
    return requested === "drift" || requested === "all";
  }

  async runGlobal(ctx: ValidationContext): Promise<LevelOutcome> {
    const errors: ValidationError[] = [];
    if (ctx.fingerprint) {
      const currentFingerprint = ctx.fingerprint;
      const driftErrors = await startSpan("bp.validate.drift", () =>
        validateDrift(ctx.files, { projectRoot: ctx.projectRoot, currentFingerprint })
      );
      errors.push(...driftErrors);
    }
    const packIntegrityErrors = await startSpan("bp.validate.pack-integrity", async () => {
      // Stage 5: best-effort upstream-drift check against the configured
      // signed registry index; offline/unconfigured runs skip it silently.
      const { loadConfiguredRegistryIndex } = await import("../../registry/client.js");
      const registryIndex = await loadConfiguredRegistryIndex();
      return validatePackIntegrity(ctx.projectRoot, { registryIndex });
    });
    errors.push(...packIntegrityErrors);
    return { errors };
  }
}
