/**
 * Public exit-code contract (stable API since v1.0.0).
 * Canonical source: docs/troubleshooting.md "Exit Code Registry" — the
 * numbering here, the BpError subclasses in errors.ts, and the docs must
 * always agree.
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGS: 2,
  CONFIG_ERROR: 3,
  STRUCTURAL_FAILURE: 4,
  SEMANTIC_FAILURE: 5,
  DRIFT_DETECTED: 6,
  TRANSLATION_ERROR: 7,
  NETWORK_ERROR: 8,
  PERMISSION_DENIED: 9,
  HEALTH_FAILURE: 10,
} as const;

export const KNOWN_SOURCE_DIRS = ["src", "lib", "app", "source"] as const;

export const KNOWN_TEST_DIRS = ["tests", "test", "__tests__", "spec", "specs"] as const;

export const KNOWN_CONFIG_DIRS = ["config", "configs", ".config", "settings"] as const;

export const KNOWN_PACKAGE_DIRS = ["packages", "apps", "services", "modules", "libs"] as const;

export const KNOWN_SERVER_FRAMEWORKS = ["nestjs", "express", "fastapi", "laravel"] as const;

export const KNOWN_UI_FRAMEWORKS = ["nextjs", "react", "vue"] as const;

export const DEFAULT_GLOB_IGNORE = ["**/node_modules/**", "**/dist/**"] as const;
