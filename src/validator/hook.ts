import * as fs from "node:fs";
import { scanForSecrets } from "../security/scan.js";
import type { ValidationError } from "./structural.js";

export function validateHookSafety(filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!fs.existsSync(filePath)) {
    errors.push({
      file: filePath,
      type: "HOOK_NOT_FOUND",
      severity: "error",
      message: `Hook file does not exist: ${filePath}`,
      resolution: "Create the hook file first, or run `bp hook generate`.",
    });
    return errors;
  }

  const content = fs.readFileSync(filePath, "utf-8");

  // Check forbidden keywords/API calls
  const forbiddenPatterns = [
    {
      regex: /child_process|exec|spawn|fork/i,
      type: "UNSAFE_HOOK_EXECUTION",
      message:
        "Hook file uses unsafe process execution APIs ('child_process', 'exec', 'spawn', 'fork')",
      resolution: "Hooks should remain logic stubs only. Avoid triggering external shell commands.",
    },
    {
      regex: /fetch|http\.|https\.|axios|request/i,
      type: "UNSAFE_HOOK_NETWORK",
      message: "Hook file makes network requests using 'fetch', 'http', 'https', or 'axios'",
      resolution:
        "Avoid performing network operations inside repository hooks to ensure offline reliability.",
    },
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(content)) {
      errors.push({
        file: filePath,
        type: pattern.type,
        severity: "error",
        message: pattern.message,
        resolution: pattern.resolution,
      });
    }
  }

  // Also run secret scan on hook file
  errors.push(...scanForSecrets(filePath, content));

  return errors;
}
