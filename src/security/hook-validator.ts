export interface HookSafetyReport {
  safe: boolean;
  violations: Array<{ pattern: string; line: number; match: string }>;
}

const FORBIDDEN_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "child_process", regex: /require\s*\(\s*['"]child_process['"]\s*\)/ },
  { name: "fs direct", regex: /require\s*\(\s*['"]fs['"]\s*\)/ },
  { name: "fetch", regex: /\bfetch\s*\(/ },
  { name: "eval", regex: /\beval\s*\(/ },
  { name: "new Function", regex: /new\s+Function\s*\(/ },
  { name: "process.env", regex: /process\.env\./ },
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
