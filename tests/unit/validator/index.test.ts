import { describe, it, expect } from "vitest";
import {
  exitCodeForResult,
  EXIT_CODES,
  runValidator,
} from "../../../src/validator/index.js";
import type { ValidationResult } from "../../../src/validator/index.js";
import type { ValidationError } from "../../../src/validator/structural.js";

const MOCK_MANIFEST = {
  backend: "claude",
  version: "2026.1",
  supported_features: {
    anchors: true,
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
  },
  file_patterns: {
    anchor: ["CLAUDE.md"],
    rules: ".claude/rules/*.md",
    skills: ".claude/skills/*.md",
    agents: ".claude/agents/*.md",
    hooks: ".claude/hooks/*",
  },
  max_file_sizes: {
    anchor: 5000,
    rules: 10000,
    skills: 15000,
    agents: 8000,
  },
  frontmatter_schema: {
    rules: {
      required: ["scope", "severity"],
      optional: [],
      severity_values: ["hard", "soft"],
    },
    skills: {
      required: ["name", "description"],
      optional: [],
    },
    agents: {
      required: ["name"],
      optional: [],
    },
  },
};

describe("exitCodeForResult", () => {
  it("returns SUCCESS (0) when passed has no errors or warnings", () => {
    const res: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      infos: [],
      level: "all",
      filesChecked: 5,
    };
    expect(exitCodeForResult(res)).toBe(EXIT_CODES.SUCCESS);
  });

  it("returns DRIFT_DETECTED (5) when passed has drift warnings but no errors", () => {
    const res: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [
        {
          file: "CLAUDE.md",
          type: "TEST_COMMAND_DRIFT",
          severity: "warning",
          message: "Drift",
          resolution: "Fix",
        },
      ],
      infos: [],
      level: "all",
      filesChecked: 5,
    };
    expect(exitCodeForResult(res)).toBe(EXIT_CODES.DRIFT_DETECTED);
  });

  it("returns LOGICAL_FAILURE (4) when logical errors are present", () => {
    const res: ValidationResult = {
      passed: false,
      errors: [
        {
          file: "rules/01-rule.md",
          type: "RULE_CONFLICT_HARD",
          severity: "error",
          message: "Conflict",
          resolution: "Fix",
        },
      ],
      warnings: [],
      infos: [],
      level: "all",
      filesChecked: 5,
    };
    expect(exitCodeForResult(res)).toBe(EXIT_CODES.LOGICAL_FAILURE);
  });

  it("returns SEMANTIC_FAILURE (3) when semantic errors are present", () => {
    const res: ValidationResult = {
      passed: false,
      errors: [
        {
          file: "rules/01-rule.md",
          type: "MISSING_SKILL_REFERENCE",
          severity: "error",
          message: "Missing skill",
          resolution: "Fix",
        },
      ],
      warnings: [],
      infos: [],
      level: "all",
      filesChecked: 5,
    };
    expect(exitCodeForResult(res)).toBe(EXIT_CODES.SEMANTIC_FAILURE);
  });

  it("returns STRUCTURAL_FAILURE (2) when structural errors are present", () => {
    const res: ValidationResult = {
      passed: false,
      errors: [
        {
          file: "rules/01-rule.md",
          type: "FRONTMATTER_PARSE_ERROR",
          severity: "error",
          message: "Malformed YAML",
          resolution: "Fix",
        },
      ],
      warnings: [],
      infos: [],
      level: "all",
      filesChecked: 5,
    };
    expect(exitCodeForResult(res)).toBe(EXIT_CODES.STRUCTURAL_FAILURE);
  });

  it("returns GENERAL_ERROR (1) on other unspecified errors", () => {
    const res: ValidationResult = {
      passed: false,
      errors: [
        {
          file: "unknown.md",
          type: "SOME_UNEXPECTED_ERROR",
          severity: "error",
          message: "Oops",
          resolution: "Fix",
        },
      ],
      warnings: [],
      infos: [],
      level: "all",
      filesChecked: 5,
    };
    expect(exitCodeForResult(res)).toBe(EXIT_CODES.GENERAL_ERROR);
  });
});
