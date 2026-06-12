/**
 * Default `DetectionStrategy` implementations, one per fingerprint concern.
 * Each delegates to its concern module (languages.ts, frameworks.ts, …);
 * the orchestrator in `index.ts` only sees the strategy interface.
 */

import type { DetectionStrategy } from "./contracts.js";
import { detectFrameworks, type FrameworkSignal } from "./frameworks.js";
import { detectLanguages, type LanguageSignal } from "./languages.js";
import { detectSecurity, type SecuritySignals } from "./security.js";
import { detectTooling, type ToolingSignals } from "./tooling.js";

export class LanguageStrategy implements DetectionStrategy<LanguageSignal[]> {
  readonly name = "languages";
  async detect(projectRoot: string): Promise<LanguageSignal[]> {
    return detectLanguages(projectRoot);
  }
}

export class FrameworkStrategy implements DetectionStrategy<FrameworkSignal[]> {
  readonly name = "frameworks";
  async detect(projectRoot: string): Promise<FrameworkSignal[]> {
    return detectFrameworks(projectRoot);
  }
}

export class ToolingStrategy implements DetectionStrategy<ToolingSignals> {
  readonly name = "tooling";
  async detect(projectRoot: string): Promise<ToolingSignals> {
    return detectTooling(projectRoot);
  }
}

export class SecuritySignalsStrategy implements DetectionStrategy<SecuritySignals> {
  readonly name = "security_signals";
  async detect(projectRoot: string): Promise<SecuritySignals> {
    return detectSecurity(projectRoot);
  }
}

/** Typed strategy set the orchestrator composes (constructor-injectable). */
export interface DetectorStrategies {
  languages: DetectionStrategy<LanguageSignal[]>;
  frameworks: DetectionStrategy<FrameworkSignal[]>;
  tooling: DetectionStrategy<ToolingSignals>;
  security: DetectionStrategy<SecuritySignals>;
}

export function createDefaultStrategies(): DetectorStrategies {
  return {
    languages: new LanguageStrategy(),
    frameworks: new FrameworkStrategy(),
    tooling: new ToolingStrategy(),
    security: new SecuritySignalsStrategy(),
  };
}
