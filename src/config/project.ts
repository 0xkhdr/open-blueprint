import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

const ProjectConfigSchema = z.object({
  backend: z.string().optional(),
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
});

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

export function saveProjectConfig(projectRoot: string, config: ProjectConfig): void {
  const configPath = path.join(projectRoot, ".bp.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function initProjectConfig(projectRoot: string, backend: string): ProjectConfig {
  const config: ProjectConfig = {
    backend,
    exclude: ["legacy/", "vendor/", "dist/"],
    plugins: [],
  };
  saveProjectConfig(projectRoot, config);
  return config;
}
