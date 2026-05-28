import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, afterAll } from "vitest";

// Set the home directory before importing user config module to bypass static hoisting evaluation
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-user-config-test-"));
const originalHome = process.env.HOME;
process.env.HOME = tmpDir;

import {
  loadUserConfig,
  saveUserConfig,
  getUserConfigValue,
  setUserConfigValue,
  CONFIG_FILE,
} from "../../../src/config/user.js";

describe("user config", () => {
  afterAll(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns default configuration values when config file does not exist", () => {
    const config = loadUserConfig();
    expect(config.default_backend).toBe("claude");
    expect(config.template_registry).toBe("https://registry.npmjs.org");
    expect(config.auto_verify_on_init).toBe(true);
  });

  it("can save, load, and round-trip user configuration properties", () => {
    saveUserConfig({
      default_backend: "cursor",
      ci_mode: true,
    });

    const loaded = loadUserConfig();
    expect(loaded.default_backend).toBe("cursor");
    expect(loaded.ci_mode).toBe(true);
  });

  it("can get and set individual configuration values by key", () => {
    setUserConfigValue("auto_fix_level", "logical");
    expect(getUserConfigValue("auto_fix_level")).toBe("logical");
  });

  it("gracefully handles invalid JSON file structure", () => {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, "{ invalid json }", "utf-8");

    const loaded = loadUserConfig();
    expect(loaded.default_backend).toBe("claude"); // returns default
  });
});
