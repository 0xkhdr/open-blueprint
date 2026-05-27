import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";

const UserConfigSchema = z.object({
  default_backend: z.string().default("claude"),
  template_registry: z.string().url().default("https://registry.npmjs.org"),
  custom_templates: z.array(z.string()).default([]),
  auto_verify_on_init: z.boolean().default(true),
  auto_fix_level: z.enum(["structural", "semantic", "logical"]).default("structural"),
  ci_mode: z.boolean().default(false),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;

const CONFIG_DIR = path.join(os.homedir(), ".bp");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function loadUserConfig(): UserConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return UserConfigSchema.parse({});
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    return UserConfigSchema.parse(raw);
  } catch {
    return UserConfigSchema.parse({});
  }
}

export function saveUserConfig(config: Partial<UserConfig>): void {
  const existing = loadUserConfig();
  const merged = { ...existing, ...config };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");
}

export function getUserConfigValue<K extends keyof UserConfig>(key: K): UserConfig[K] {
  return loadUserConfig()[key];
}

export function setUserConfigValue<K extends keyof UserConfig>(key: K, value: UserConfig[K]): void {
  saveUserConfig({ [key]: value });
}

export { CONFIG_DIR, CONFIG_FILE };
