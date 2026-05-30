export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  STRUCTURAL_FAILURE: 2,
  SEMANTIC_FAILURE: 3,
  LOGICAL_FAILURE: 4,
  DRIFT_DETECTED: 5,
  UNSUPPORTED_BACKEND: 6,
  TEMPLATE_NOT_FOUND: 7,
  PERMISSION_DENIED: 8,
  REGISTRY_UNREACHABLE: 9,
  SIGNATURE_FAILED: 10,
} as const;

export const KNOWN_SOURCE_DIRS = ["src", "lib", "app", "source"] as const;

export const KNOWN_TEST_DIRS = ["tests", "test", "__tests__", "spec", "specs"] as const;

export const KNOWN_CONFIG_DIRS = ["config", "configs", ".config", "settings"] as const;

export const KNOWN_PACKAGE_DIRS = ["packages", "apps", "services", "modules", "libs"] as const;

export const KNOWN_SERVER_FRAMEWORKS = ["nestjs", "express", "fastapi", "laravel"] as const;

export const KNOWN_UI_FRAMEWORKS = ["nextjs", "react", "vue"] as const;

export const DEFAULT_GLOB_IGNORE = ["**/node_modules/**", "**/dist/**"] as const;
