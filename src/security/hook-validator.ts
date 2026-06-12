export interface HookSafetyReport {
  safe: boolean;
  violations: Array<{ pattern: string; line: number; match: string }>;
}

/**
 * Advisory static analysis — a regex denylist, not a sandbox. It blocks the
 * common dangerous constructs in CommonJS *and* ESM form (`require`, static
 * `import`, dynamic `import()`, `node:`-prefixed specifiers) plus indirect
 * access through bracket notation (`globalThis["eval"]`, `process["env"]`).
 * Determined obfuscation can still slip past; treat a "safe" verdict as
 * lint-level confidence only (see docs/commands.md `bp hook validate`).
 */
const FORBIDDEN_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: "child_process",
    regex: /(?:require\s*\(\s*|import\s*\(\s*|from\s+|import\s+)['"](?:node:)?child_process['"]/,
  },
  {
    name: "fs direct",
    regex:
      /(?:require\s*\(\s*|import\s*\(\s*|from\s+|import\s+)['"](?:node:)?fs(?:\/promises)?['"]/,
  },
  {
    name: "dynamic import",
    regex: /\bimport\s*\(/,
  },
  { name: "fetch", regex: /\bfetch\s*\(/ },
  { name: "eval", regex: /\beval\s*\(/ },
  { name: "indirect eval", regex: /\b(?:globalThis|window|self)\s*\[\s*['"`]eval['"`]\s*\]/ },
  { name: "new Function", regex: /new\s+Function\s*\(/ },
  {
    name: "Function constructor",
    regex: /\b(?:globalThis|window|self)\s*\[\s*['"`]Function['"`]\s*\]/,
  },
  { name: "process.env", regex: /process\s*(?:\.\s*env\b|\[\s*['"`]env['"`]\s*\])/ },
  { name: "exec", regex: /\.exec\s*\(/ },
  { name: "spawn", regex: /\.spawn\s*\(/ },
];

export function validateHookSafety(code: string): HookSafetyReport {
  const violations: Array<{ pattern: string; line: number; match: string }> = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const pattern of FORBIDDEN_PATTERNS) {
      const m = line.match(pattern.regex);
      if (m) {
        violations.push({ pattern: pattern.name, line: i + 1, match: m[0] });
      }
    }
  }

  return { safe: violations.length === 0, violations };
}
