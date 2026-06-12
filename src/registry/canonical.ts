/**
 * Canonical JSON (Stage 5 §1): deterministic serialization used for artifact
 * manifest signing and registry index signing. Object keys are sorted
 * recursively and no insignificant whitespace is emitted, so the same logical
 * document always produces the same bytes — and therefore the same signature.
 *
 * Semantics match `JSON.stringify` for unsupported values: `undefined` and
 * functions are dropped from objects and serialized as `null` inside arrays.
 */

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = sortValue(source[key]);
    }
    return out;
  }
  return value;
}

/** Serialize a value as canonical JSON: sorted keys, no whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}
