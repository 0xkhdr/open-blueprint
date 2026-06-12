import type { BlueprintIR } from "./ir.js";

/**
 * Contract every backend adapter implements (one adapter per tool in
 * `src/backends/registry.ts`; shared bases live in `adapters/base/`).
 *
 * Defined in its own module — not `translator/index.ts` — so adapters can
 * import the type without importing the loader that imports them back
 * (this move erased 12 type-only import cycles).
 *
 * ## Contract
 *
 * `parse(projectRoot)`
 * - Precondition: `projectRoot` is an existing directory. Adapters must not
 *   write, execute code, shell out, or touch the network — static file reads
 *   only.
 * - Postcondition: returns a `BlueprintIR` that satisfies `BlueprintIRSchema`
 *   (schema version "2.0"). A project with no governance files yields a valid
 *   minimal IR, not an error.
 * - Errors: unreadable/malformed governance files throw (a `BpError` subclass
 *   where one fits); adapters never swallow parse failures silently.
 *
 * `render(ir, projectRoot)`
 * - Precondition: `ir` is schema-valid. Rendering must be deterministic for
 *   the same `ir` (no randomness in file content). Known exemption: the
 *   shared AGENTS.md generator embeds a `**Generated:**` timestamp line;
 *   the contract suite normalizes it. Do not add new nondeterminism.
 * - Postcondition: returns the list of file paths written. Re-rendering the
 *   same IR is idempotent and must respect `bp:preserve` blocks.
 * - Errors: filesystem failures propagate; partial writes are not reported as
 *   success.
 *
 * Liskov: callers (`getAdapter`, validator governance level, round-trip
 * fidelity checks) depend only on this interface; any adapter must be
 * substitutable under the rules above.
 */
export interface BlueprintAdapter {
  parse(projectRoot: string): Promise<BlueprintIR>;
  render(ir: BlueprintIR, projectRoot: string): Promise<string[]>;
}
