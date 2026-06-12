import type { LevelValidator, ValidatorServices } from "../contracts.js";
import { BackendRulesLevel } from "./backend-rules.js";
import { DriftLevel } from "./drift.js";
import { EnforcementLevel } from "./enforcement.js";
import { GovernanceLevel } from "./governance.js";
import { LogicalLevel } from "./logical.js";
import { SemanticLevel } from "./semantic.js";
import { StructuralLevel } from "./structural.js";

/**
 * Level registry. Array order is execution order: the pipeline runs every
 * file-scoped phase in this order first, then every global phase.
 *
 * Adding a level = one new file implementing `LevelValidator` + one entry
 * here. No pipeline edits (see tests/unit/validator/pipeline.test.ts for the
 * extension walkthrough).
 */
export function createDefaultLevels(services: ValidatorServices): LevelValidator[] {
  return [
    new StructuralLevel(),
    new SemanticLevel(),
    new LogicalLevel(),
    new EnforcementLevel(),
    new DriftLevel(),
    new GovernanceLevel(services.blueprintSource),
    new BackendRulesLevel(),
  ];
}
