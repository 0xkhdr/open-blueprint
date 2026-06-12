import * as path from "node:path";
import { startSpan } from "../../telemetry/tracer.js";
import type { ValidationError } from "../../types/validation.js";
import { validateAlertingConfig } from "../alerting.js";
import type {
  BlueprintSource,
  LevelOutcome,
  LevelValidator,
  ValidationContext,
  ValidationLevel,
} from "../contracts.js";
import { validateCostConfig } from "../cost.js";
import { validateCrossLayerReferences } from "../cross-layer.js";
import {
  validateAudit,
  validateCommands,
  validateCompliance,
  validateIdentity,
  validateMCPServers,
  validateOrchestration,
  validateRegistry,
  validateRisk,
  validateSettings,
} from "../layers.js";
import {
  validateCommandsDeep,
  validateMCPServersDeep,
  validateSettingsDeep,
} from "../layers-deep.js";
import { validateOrchestrationSemantic } from "../orchestration.js";
import { auditPerformance } from "../performance.js";
import { validateRBAC } from "../rbac.js";

function mapLayerErrors(
  layerName: string,
  rawErrors: Array<{ message: string; field?: string }>,
  blueprintFile: string
): ValidationError[] {
  const type = `GOVERNANCE_${layerName.toUpperCase().replace(/\s+/g, "_")}_INVALID`;
  return rawErrors.map((e) => ({
    file: blueprintFile,
    type,
    severity: "error" as const,
    message: `${layerName} layer: ${e.message}`,
    resolution: `Fix ${layerName.toLowerCase()} configuration at ${e.field || "root"}`,
  }));
}

/**
 * Level 5 — governance: enterprise layers of the parsed IR (settings,
 * commands, MCP, identity/RBAC, audit, compliance, risk, registry,
 * orchestration, cost, alerting).
 *
 * The IR comes from the injected `BlueprintSource` — this level never
 * imports the translator's adapter registry directly (DIP).
 */
export class GovernanceLevel implements LevelValidator {
  readonly name = "governance";
  readonly skipOnStructuralFailure = false;

  constructor(private readonly blueprintSource: BlueprintSource) {}

  enabledFor(requested: ValidationLevel): boolean {
    return requested === "governance" || requested === "all";
  }

  async runGlobal(ctx: ValidationContext): Promise<LevelOutcome> {
    const errors = await startSpan("bp.validate.governance", () =>
      this.validateGovernance(ctx.projectRoot, ctx.manifest.backend, ctx)
    );
    return { errors };
  }

  private async validateGovernance(
    projectRoot: string,
    backend: string,
    ctx: ValidationContext
  ): Promise<ValidationError[]> {
    try {
      const ir = await this.blueprintSource.parse(projectRoot, backend);

      const errors: ValidationError[] = [];
      const blueprintFile = ctx.manifest.file_patterns.anchor[0]
        ? path.join(projectRoot, ctx.manifest.file_patterns.anchor[0])
        : path.join(projectRoot, ".claude", "blueprint.json");

      // Validate each enterprise layer
      if (ir.settings) {
        errors.push(...mapLayerErrors("settings", validateSettings(ir.settings), blueprintFile));
      }

      if (ir.commands && ir.commands.length > 0) {
        errors.push(...mapLayerErrors("commands", validateCommands(ir.commands), blueprintFile));
      }

      if (ir.mcp_servers && ir.mcp_servers.length > 0) {
        errors.push(
          ...mapLayerErrors("mcp servers", validateMCPServers(ir.mcp_servers), blueprintFile)
        );
      }

      if (ir.identity !== undefined) {
        errors.push(...mapLayerErrors("identity", validateIdentity(ir.identity), blueprintFile));
        const rbacErrors = validateRBAC({ identity: ir.identity }, blueprintFile);
        errors.push(...rbacErrors);
      }

      if (ir.audit) {
        errors.push(...mapLayerErrors("audit", validateAudit(ir.audit), blueprintFile));
      }

      if (ir.compliance) {
        errors.push(
          ...mapLayerErrors("compliance", validateCompliance(ir.compliance), blueprintFile)
        );
      }

      if (ir.risk) {
        errors.push(...mapLayerErrors("risk", validateRisk(ir.risk), blueprintFile));
      }

      if (ir.registry) {
        errors.push(...mapLayerErrors("registry", validateRegistry(ir.registry), blueprintFile));
      }

      if (ir.orchestration) {
        errors.push(
          ...mapLayerErrors("orchestration", validateOrchestration(ir.orchestration), blueprintFile)
        );
      }

      // Semantic orchestration + cross-layer validation (always runs in governance mode)
      errors.push(...validateOrchestrationSemantic(ir));

      // Cross-layer reference validation
      errors.push(...validateCrossLayerReferences(ir, blueprintFile));

      // Layer 6-8 deep validation
      errors.push(...validateSettingsDeep(ir, blueprintFile));
      errors.push(...validateCommandsDeep(ir, blueprintFile));
      errors.push(...validateMCPServersDeep(ir, blueprintFile));

      // Performance audit
      errors.push(...auditPerformance(ir, blueprintFile).warnings);

      // Phase 4: Observability & Cost validation
      if (ir.cost) {
        errors.push(...validateCostConfig(ir));
      }

      if (ir.alerting) {
        errors.push(...validateAlertingConfig(ir));
      }

      return errors;
    } catch (err) {
      return [
        {
          file: path.join(projectRoot, ".claude", "blueprint.json"),
          type: "GOVERNANCE_PARSE_ERROR",
          severity: "error",
          message: `Failed to parse blueprint for governance validation: ${String(err)}`,
          resolution: "Ensure blueprint is valid JSON/YAML and conforms to IR schema",
        },
      ];
    }
  }
}
