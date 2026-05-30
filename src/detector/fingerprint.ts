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
  "php",
]);

const _identifierField = z
  .string()
  .max(64)
  .regex(/^[a-z0-9_-]+$/);
const freeStringField = z.string().max(512);
const pathField = z.string().max(256);

export const FingerprintSchema = z.object({
  version: z.literal("1.0"),
  detected_at: z.string().datetime(),
  project: z.object({
    name: freeStringField,
    root: pathField,
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
      name: freeStringField,
      confidence: z.number().min(0).max(1),
    })
  ),
  entry_points: z.array(
    z.object({
      path: pathField,
      type: z.enum(["cli", "server", "library", "ui"]),
    })
  ),
  tooling: z.object({
    package_manager: freeStringField.optional(),
    test_runner: freeStringField.optional(),
    test_command: freeStringField.optional(),
    build_tool: freeStringField.optional(),
    linter: freeStringField.optional(),
    formatter: freeStringField.optional(),
    ci_system: freeStringField.optional(),
  }),
  directory_topology: z.object({
    src_dirs: z.array(freeStringField),
    test_dirs: z.array(freeStringField),
    config_dirs: z.array(freeStringField),
    package_dirs: z.array(freeStringField),
  }),
  security_signals: z.object({
    has_auth: z.boolean(),
    has_external_apis: z.boolean(),
    has_secrets_manager: z.boolean(),
    has_docker: z.boolean(),
    has_data_sensitive: z.boolean().optional(),
    has_financial_data: z.boolean().optional(),
    has_pii: z.boolean().optional(),
    has_encryption: z.boolean().optional(),
  }),
});

export type Fingerprint = z.infer<typeof FingerprintSchema>;
export type LanguageName = z.infer<typeof LanguageNameSchema>;
