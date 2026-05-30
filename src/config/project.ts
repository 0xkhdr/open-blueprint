import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";

const BackendConfigOverrideSchema = z.object({
  delivery_mode: z.enum(["skills_and_commands", "skills_only", "commands_only"]).optional(),
  workflows: z.array(z.string()).optional(),
});

const ProjectConfigSchemaRaw = z.object({
  backend: z.string().optional(),
  backends: z.array(z.string()).optional(),
  primary_backend: z.string().optional(),
  backend_configs: z.record(z.string(), BackendConfigOverrideSchema).optional(),
  extends: z.string().optional(),
  overrides: z
    .object({
      rules: z
        .object({
          severity_defaults: z.enum(["hard", "soft", "info"]).optional(),
        })
        .optional(),
    })
    .optional(),
  exclude: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
  scan: z
    .object({
      entropyEnabled: z.boolean().optional(),
    })
    .optional(),
});

const ProjectConfigSchema = ProjectConfigSchemaRaw.transform((data) => {
  if (data.backend && !data.backends) {
    return {
      ...data,
      backends: [data.backend],
      primary_backend: data.backend,
    };
  }
  return data;
}).superRefine((data, ctx) => {
  if (data.primary_backend && data.backends) {
    if (!data.backends.includes(data.primary_backend)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `primary_backend "${data.primary_backend}" is not in backends array`,
        path: ["primary_backend"],
      });
    }
  }
});

export type BackendConfigOverride = z.infer<typeof BackendConfigOverrideSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export function loadProjectConfig(projectRoot: string): ProjectConfig | null {
  const configPath = path.join(projectRoot, ".bp.json");
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return ProjectConfigSchema.parse(raw);
  } catch {
    return null;
  }
}

export async function loadProjectConfigAsync(projectRoot: string): Promise<ProjectConfig | null> {
  const configPath = path.join(projectRoot, ".bp.json");
  try {
    const raw = JSON.parse(await fsPromises.readFile(configPath, "utf-8"));
    return ProjectConfigSchema.parse(raw);
  } catch {
    return null;
  }
}

export function saveProjectConfig(projectRoot: string, config: Omit<ProjectConfig, never>): void {
  const configPath = path.join(projectRoot, ".bp.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function initProjectConfig(
  projectRoot: string,
  backends: string[],
  primaryBackend?: string
): ProjectConfig {
  const primary = primaryBackend ?? backends[0];
  const raw = {
    backends,
    primary_backend: primary,
    exclude: ["legacy/", "vendor/", "dist/"],
    plugins: [],
  };
  fs.writeFileSync(path.join(projectRoot, ".bp.json"), JSON.stringify(raw, null, 2), "utf-8");
  return ProjectConfigSchema.parse(raw);
}

export function isV1Config(raw: Record<string, unknown>): boolean {
  return "backend" in raw && !("backends" in raw);
}
