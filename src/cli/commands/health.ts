import * as https from "node:https";
import chalk from "chalk";
import { Command } from "commander";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { HealthError } from "../../errors.js";
import { getCorrelationId } from "../../logger.js";

interface HealthCheck {
  name: string;
  status: "PASS" | "FAIL";
  message: string;
}

export async function checkConfigParseable(cwd: string): Promise<HealthCheck> {
  try {
    const cfg = loadProjectConfig(cwd);
    void cfg;
    return { name: "config-parse", status: "PASS", message: "Config file parseable" };
  } catch (e) {
    return {
      name: "config-parse",
      status: "FAIL",
      message: `Config parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function checkEnginesImportable(): Promise<HealthCheck> {
  try {
    await import("../../detector/index.js");
    await import("../../validator/index.js");
    await import("../../translator/index.js");
    await import("../../templater/index.js");
    return { name: "engines-importable", status: "PASS", message: "All engine modules importable" };
  } catch (e) {
    return {
      name: "engines-importable",
      status: "FAIL",
      message: `Engine import error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function checkRegistryReachable(): Promise<HealthCheck> {
  const registryUrl = "https://registry.npmjs.org";
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        name: "registry-reachable",
        status: "FAIL",
        message: "Registry HEAD request timed out (5s)",
      });
    }, 5000);

    const req = https.request(registryUrl, { method: "HEAD" }, (res) => {
      clearTimeout(timeout);
      const ok = res.statusCode !== undefined && res.statusCode < 500;
      resolve({
        name: "registry-reachable",
        status: ok ? "PASS" : "FAIL",
        message: ok
          ? `Registry reachable (HTTP ${res.statusCode})`
          : `Registry returned HTTP ${res.statusCode}`,
      });
      res.resume();
    });

    req.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        name: "registry-reachable",
        status: "FAIL",
        message: `Registry unreachable: ${err.message}`,
      });
    });

    req.end();
  });
}

export async function checkNoConflictingConfigs(cwd: string): Promise<HealthCheck> {
  try {
    const projectCfg = loadProjectConfig(cwd);
    const userCfg = loadUserConfig();

    if (projectCfg && userCfg) {
      // Check for conflicting default_backend
      const projBackend = (projectCfg as Record<string, unknown>).default_backend;
      const userBackend = (userCfg as Record<string, unknown>).default_backend;
      if (projBackend && userBackend && projBackend !== userBackend) {
        return {
          name: "no-config-conflict",
          status: "FAIL",
          message: `Conflicting default_backend: project='${projBackend}' vs global='${userBackend}'`,
        };
      }
    }
    return {
      name: "no-config-conflict",
      status: "PASS",
      message: "No conflicting configurations found",
    };
  } catch (e) {
    return {
      name: "no-config-conflict",
      status: "FAIL",
      message: `Config conflict check error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export function createHealthCommand(): Command {
  const cmd = new Command("health")
    .description("Run health checks for CI and environment diagnostics")
    .option("--json", "Output results as JSON")
    .action(async (opts: { json?: boolean }) => {
      const cwd = process.cwd();
      const version = "1.0.0";
      const correlationId = getCorrelationId();

      const checks = await Promise.all([
        checkConfigParseable(cwd),
        checkEnginesImportable(),
        checkRegistryReachable(),
        checkNoConflictingConfigs(cwd),
      ]);

      const allPass = checks.every((c) => c.status === "PASS");
      const overallStatus = allPass ? "PASS" : "FAIL";

      if (opts.json) {
        const output = {
          status: overallStatus,
          checks,
          version,
          correlationId,
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(
          chalk.bold(`\n  bp health — ${allPass ? chalk.green("PASS") : chalk.red("FAIL")}\n`)
        );
        for (const check of checks) {
          const icon = check.status === "PASS" ? chalk.green("✔") : chalk.red("✗");
          const label = check.status === "PASS" ? chalk.green(check.name) : chalk.red(check.name);
          console.log(`  ${icon} ${label}: ${check.message}`);
        }
        console.log();
      }

      if (!allPass) {
        const failed = checks
          .filter((c) => c.status === "FAIL")
          .map((c) => c.name)
          .join(", ");
        throw new HealthError(
          `Health check failed: ${failed}. Fix: Resolve the failing checks above.`
        );
      }
    });

  return cmd;
}
