import fc from "fast-check";
import type { Fingerprint } from "../../../src/detector/fingerprint.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

const identifierArb = fc
  .stringMatching(/^[a-z][a-z0-9_-]{0,30}$/)
  .filter((s) => s.length > 0 && s.length <= 64);

const shortStringArb = fc.string({ minLength: 0, maxLength: 60 }).filter((s) => /^[^\x00-\x1f\x7f]*$/.test(s));

const pathArb = fc.string({ minLength: 1, maxLength: 60 }).filter((s) => /^[^\x00-\x1f\x7f]*$/.test(s));

export function fingerprintArbitrary(): fc.Arbitrary<Fingerprint> {
  return fc.record({
    version: fc.constant("1.0" as const),
    detected_at: fc.constant(new Date("2024-01-01T00:00:00.000Z").toISOString()),
    project: fc.record({
      name: shortStringArb.filter((s) => s.length > 0 && s.length <= 512),
      root: pathArb.filter((s) => s.length <= 256),
      type: fc.constantFrom("monorepo", "polyrepo", "library", "application", "service" as const),
      git_workflow: fc.constantFrom("github-flow", "trunk-based", "gitflow", "unknown" as const),
    }),
    languages: fc.array(
      fc.record({
        name: fc.constantFrom(
          "typescript",
          "javascript",
          "python",
          "go",
          "rust",
          "java",
          "ruby",
          "dart",
          "cpp",
          "csharp",
          "swift",
          "php" as const
        ),
        confidence: fc.float({ min: 0, max: 1, noNaN: true }),
        primary: fc.boolean(),
      }),
      { minLength: 0, maxLength: 3 }
    ),
    frameworks: fc.array(
      fc.record({
        name: shortStringArb.filter((s) => s.length > 0 && s.length <= 512),
        confidence: fc.float({ min: 0, max: 1, noNaN: true }),
      }),
      { minLength: 0, maxLength: 3 }
    ),
    entry_points: fc.array(
      fc.record({
        path: pathArb.filter((s) => s.length <= 256),
        type: fc.constantFrom("cli", "server", "library", "ui" as const),
      }),
      { minLength: 0, maxLength: 3 }
    ),
    tooling: fc.record({
      package_manager: fc.option(identifierArb, { nil: undefined }),
      test_runner: fc.option(identifierArb, { nil: undefined }),
      test_command: fc.option(shortStringArb.filter((s) => s.length <= 512), { nil: undefined }),
      build_tool: fc.option(identifierArb, { nil: undefined }),
      linter: fc.option(identifierArb, { nil: undefined }),
      formatter: fc.option(identifierArb, { nil: undefined }),
      ci_system: fc.option(identifierArb, { nil: undefined }),
    }),
    directory_topology: fc.record({
      src_dirs: fc.array(identifierArb, { minLength: 0, maxLength: 3 }),
      test_dirs: fc.array(identifierArb, { minLength: 0, maxLength: 3 }),
      config_dirs: fc.array(identifierArb, { minLength: 0, maxLength: 3 }),
      package_dirs: fc.array(identifierArb, { minLength: 0, maxLength: 3 }),
    }),
    security_signals: fc.record({
      has_auth: fc.boolean(),
      has_external_apis: fc.boolean(),
      has_secrets_manager: fc.boolean(),
      has_docker: fc.boolean(),
      has_data_sensitive: fc.option(fc.boolean(), { nil: undefined }),
      has_financial_data: fc.option(fc.boolean(), { nil: undefined }),
      has_pii: fc.option(fc.boolean(), { nil: undefined }),
      has_encryption: fc.option(fc.boolean(), { nil: undefined }),
    }),
    workspacePackages: fc.array(
      fc.string({ minLength: 1, maxLength: 60 }).filter((s) => /^[^\x00-\x1f\x7f]*$/.test(s)),
      { minLength: 0, maxLength: 3 }
    ),
  }) as fc.Arbitrary<Fingerprint>;
}

export function blueprintIRArbitrary(): fc.Arbitrary<BlueprintIR> {
  const safeContent = fc.string({ minLength: 0, maxLength: 200 }).filter((s) => /^[^\x00-\x1f\x7f]*$/.test(s));
  const safeShort = fc.string({ minLength: 0, maxLength: 60 }).filter((s) => /^[^\x00-\x1f\x7f]*$/.test(s));
  const safeId = fc.stringMatching(/^[a-z][a-z0-9_-]{0,30}$/);
  const safeGlob = fc.string({ minLength: 1, maxLength: 60 })
    .filter((s) => /^[^\x00-\x1f\x7f]*$/.test(s) && !/\*{4,}/.test(s));

  return fc.record({
    version: fc.constant("2.0" as const),
    spatial_anchor: fc.record({
      project_name: safeShort,
      surface: safeShort,
      temporal_anchor: safeShort,
      conventions: fc.array(safeShort, { minLength: 0, maxLength: 2 }),
    }),
    personas: fc.array(
      fc.record({
        name: safeShort,
        role: safeShort,
        reasoning_style: safeShort,
        constraints: fc.array(safeShort, { minLength: 0, maxLength: 2 }),
        allowed_tools: fc.option(fc.array(safeShort, { minLength: 0, maxLength: 2 }), { nil: undefined }),
      }),
      { minLength: 0, maxLength: 2 }
    ),
    rules: fc.array(
      fc.record({
        id: safeId,
        scope: safeGlob,
        severity: fc.constantFrom("hard", "soft" as const),
        action: safeContent,
        rationale: fc.option(safeContent, { nil: undefined }),
        tags: fc.option(fc.array(safeShort, { minLength: 0, maxLength: 2 }), { nil: undefined }),
      }),
      { minLength: 0, maxLength: 2 }
    ),
    skills: fc.array(
      fc.record({
        name: safeShort,
        description: safeShort,
        when_to_use: safeContent,
        tools_required: fc.array(safeShort, { minLength: 0, maxLength: 2 }),
        procedure: safeContent,
        disable_model_invocation: fc.option(fc.boolean(), { nil: undefined }),
      }),
      { minLength: 0, maxLength: 2 }
    ),
    hooks: fc.constant([]),
    meta: fc.record({
      rule_precedence: fc.array(safeShort, { minLength: 0, maxLength: 2 }),
      conflict_resolution: safeShort,
      source_backend: safeShort,
      target_backend: safeShort,
      target_backends: fc.option(fc.array(safeShort, { minLength: 0, maxLength: 2 }), { nil: undefined }),
      schema_version: fc.option(fc.constantFrom("1.0", "2.0" as const), { nil: undefined }),
    }),
  }) as fc.Arbitrary<BlueprintIR>;
}
