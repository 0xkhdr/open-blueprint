/**
 * Shared validation finding shape.
 *
 * Lives in the L0 `types/` layer so infrastructure modules (e.g.
 * `security/scan.ts`) can produce findings without importing the validator
 * engine (previously a structural.ts ↔ security/scan.ts cycle and an
 * upward L1→L2 dependency).
 *
 * Contract: `message` states what is wrong; `resolution` is an actionable
 * fix — both required, never fabricated. `file` (and `line` when known)
 * point at the offending location.
 */
export interface ValidationError {
  file: string;
  line?: number;
  type: string;
  severity: "error" | "warning" | "info";
  message: string;
  resolution: string;
}
