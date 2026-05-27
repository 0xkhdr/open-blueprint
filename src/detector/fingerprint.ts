import { z } from "zod";

export const LanguageNameSchema = z.enum([
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
]);

export const FingerprintSchema = z.object({
  version: z.literal("1.0"),
  detected_at: z.string().datetime(),
  project: z.object({
    name: z.string(),
    root: z.string(),
    type: z.enum(["monorepo", "polyrepo", "library", "application", "service"]),
    git_workflow: z.enum(["github-flow", "trunk-based", "gitflow", "unknown"]),
  }),
  languages: z.array(
    z.object({
      name: LanguageNameSchema,
      confidence: z.number().min(0).max(1),
      primary: z.boolean(),
    })
  ),
  frameworks: z.array(
    z.object({
      name: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
  entry_points: z.array(
    z.object({
      path: z.string(),
      type: z.enum(["cli", "server", "library", "ui"]),
    })
  ),
  tooling: z.object({
    package_manager: z.string().optional(),
    test_runner: z.string().optional(),
    test_command: z.string().optional(),
    build_tool: z.string().optional(),
    linter: z.string().optional(),
    formatter: z.string().optional(),
    ci_system: z.string().optional(),
  }),
  directory_topology: z.object({
    src_dirs: z.array(z.string()),
    test_dirs: z.array(z.string()),
    config_dirs: z.array(z.string()),
    package_dirs: z.array(z.string()),
  }),
  security_signals: z.object({
    has_auth: z.boolean(),
    has_external_apis: z.boolean(),
    has_secrets_manager: z.boolean(),
    has_docker: z.boolean(),
  }),
});

export type Fingerprint = z.infer<typeof FingerprintSchema>;
export type LanguageName = z.infer<typeof LanguageNameSchema>;
