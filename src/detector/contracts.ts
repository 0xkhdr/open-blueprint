import type { FileSystem } from "../utils/fs.js";

/**
 * One detection concern (languages, frameworks, tooling, security signals…)
 * contributing a typed slice of the Fingerprint.
 *
 * Contract:
 * - **Static analysis only**: implementations read files/directories through
 *   the provided `FileSystem` (or equivalent read-only access) — no network,
 *   no shell, no code execution. This is a repo-wide invariant, not a
 *   guideline.
 * - `detect` never throws for an analyzable-but-empty project; absence of
 *   signal is an empty result, not an error. Genuine failures (unreadable
 *   root) propagate to the orchestrator.
 * - Results must be deterministic for the same project tree.
 *
 * The orchestrator (`detector/index.ts`) composes strategies and owns
 * Fingerprint assembly + schema validation; adding a concern means a new
 * strategy in `strategies.ts` — orchestration code does not change shape.
 */
export interface DetectionStrategy<T> {
  readonly name: string;
  detect(projectRoot: string, fs: FileSystem): Promise<T>;
}
