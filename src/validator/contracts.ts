/**
 * Contracts for the validation pipeline (Stage 2 SOLID refactor).
 *
 * `index.ts` composes `LevelValidator` instances from the level registry
 * (`levels/registry.ts`); adding a seventh level means writing one new file
 * implementing `LevelValidator` and appending it to the registry — no
 * pipeline edits.
 */

import type { Fingerprint } from "../detector/fingerprint.js";
import type { BackendManifest } from "../templater/selector.js";
import type { BlueprintIR } from "../translator/ir.js";
import type { ValidationError } from "../types/validation.js";
import type { EnforcementSummary } from "./enforcement.js";

export type ValidationLevel =
  | "structural"
  | "semantic"
  | "logical"
  | "enforcement"
  | "drift"
  | "governance"
  | "all";

export interface ValidatorOptions {
  level: ValidationLevel;
  projectRoot: string;
  manifest: BackendManifest;
  fingerprint?: Fingerprint;
  json?: boolean;
  failOn?: ValidationLevel;
  /** Skip plugin validators configured in .bp.json (verify --no-plugins). */
  noPlugins?: boolean;
  /** Entropy-based secret detection (verify --entropy-scan / .bp.json scan.entropyEnabled). */
  entropyScan?: boolean;
  /**
   * Dependency-injection seams (DIP). Unset fields fall back to the default
   * wiring in `default-wiring.ts`; orchestrators (CLI, LSP, dev server) may
   * override them to supply their own implementations.
   */
  services?: Partial<ValidatorServices>;
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  level: ValidationLevel;
  filesChecked: number;
  enforcement?: EnforcementSummary;
}

/**
 * Shared, pipeline-owned state passed to every level.
 *
 * Levels read from the context; only the pipeline mutates it (it sets
 * `structuralFailed` from the structural level's outcome before running
 * dependent levels).
 */
export interface ValidationContext {
  readonly projectRoot: string;
  readonly manifest: BackendManifest;
  readonly fingerprint: Fingerprint | undefined;
  readonly options: ValidatorOptions;
  /** Every blueprint file matched by the backend manifest patterns. */
  readonly files: string[];
  /** Subset of `files` that missed the validation cache (new/modified). */
  readonly filesToValidate: string[];
  /** True once the structural level reported at least one error. */
  structuralFailed: boolean;
}

export interface LevelOutcome {
  errors: ValidationError[];
  /** Only the enforcement level produces a summary. */
  enforcement?: EnforcementSummary;
}

/**
 * One validation level.
 *
 * Contract:
 * - Levels are pure with respect to the context: they must not mutate it and
 *   must not depend on another level's concrete class (cross-level data flows
 *   only through `ValidationContext`).
 * - `runFileScoped` validates `ctx.filesToValidate` and returns findings whose
 *   `file` field identifies the validated file — the pipeline caches them
 *   per file. `runGlobal` runs project-wide checks that bypass the cache.
 *   A level may implement either or both; the pipeline calls all
 *   `runFileScoped` phases (registry order) before any `runGlobal` phase.
 * - Static analysis only: no network, no shell, no code execution.
 * - Failures throw `BpError` subclasses (e.g. `ResourceLimitError`); levels
 *   never call `process.exit`.
 */
export interface LevelValidator {
  /** Unique level name; used for telemetry span names (`bp.validate.<name>`). */
  readonly name: string;
  /** Whether this level participates in a run requested at `requested` level. */
  enabledFor(requested: ValidationLevel): boolean;
  /** Skip this level when structural validation already hard-failed. */
  readonly skipOnStructuralFailure: boolean;
  /**
   * Pipeline sets `ctx.structuralFailed` from this level's file-scoped errors
   * (exactly one registered level should set this).
   */
  readonly marksStructuralFailure?: boolean;
  runFileScoped?(ctx: ValidationContext): Promise<ValidationError[]>;
  runGlobal?(ctx: ValidationContext): Promise<LevelOutcome>;
}

/**
 * Parses a project's governance files into the backend-neutral IR.
 *
 * Inverted dependency: the validator consumes this interface instead of
 * importing the translator's adapter registry (a concrete engine→engine
 * dependency). Default wiring resolves it lazily in `default-wiring.ts`.
 */
export interface BlueprintSource {
  parse(projectRoot: string, backend: string): Promise<BlueprintIR>;
}

/**
 * Runs the plugin validators configured in `.bp.json` for the active levels.
 * Returns an empty array when no plugins apply (the pipeline does not need
 * to know how plugins are resolved or isolated).
 */
export interface PluginEngine {
  run(ctx: ValidationContext): Promise<ValidationError[]>;
}

/** Resolved service set the pipeline runs with (see `ValidatorOptions.services`). */
export interface ValidatorServices {
  blueprintSource: BlueprintSource;
  pluginEngine: PluginEngine;
}
