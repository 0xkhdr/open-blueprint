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
  codex_home: z.string().optional(),
  /** Signed static-host registry index URL (Stage 5): `bp config set registry.url …`. */
  registry_url: z.string().url().optional(),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;

const CONFIG_DIR = path.join(os.homedir(), ".bp");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// Resolved lazily so a BP_HOME override (tests, sandboxes) set after module
// load is still honored.
function configDir(): string {
  return process.env.BP_HOME ?? CONFIG_DIR;
}

function configFile(): string {
  return path.join(configDir(), "config.json");
}

export function loadUserConfig(): UserConfig {
  if (!fs.existsSync(configFile())) {
    return UserConfigSchema.parse({});
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configFile(), "utf-8"));
    return UserConfigSchema.parse(raw);
  } catch {
    return UserConfigSchema.parse({});
  }
}

export function saveUserConfig(config: Partial<UserConfig>): void {
  const existing = loadUserConfig();
  const merged = { ...existing, ...config };
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(merged, null, 2), "utf-8");
}

export function getUserConfigValue<K extends keyof UserConfig>(key: K): UserConfig[K] {
  return loadUserConfig()[key];
}

export function setUserConfigValue<K extends keyof UserConfig>(key: K, value: UserConfig[K]): void {
  saveUserConfig({ [key]: value });
}

export { CONFIG_DIR, CONFIG_FILE };
