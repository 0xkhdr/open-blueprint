import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import matter from "gray-matter";
import { type BackendConfig, getBackend, listBackendIds } from "../../backends/registry.js";
import { loadProjectConfig } from "../../config/project.js";
import { detect, enrichFingerprint } from "../../detector/index.js";
import { formatGapReport, generateGapReport } from "../../enterprise/compliance-report.js";
import { generateEnvTemplate } from "../../enterprise/env-template.js";
import { generateEscalationRunbook } from "../../enterprise/runbooks.js";
import { BpError } from "../../errors.js";
import { scanDirectory } from "../../security/scan.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { getAdapter } from "../../translator/index.js";
import { normalizeError } from "../../utils/errors.js";
import { generateComplianceReport } from "../../validator/compliance.js";
import { EXIT_CODES } from "../../validator/index.js";

interface BackendHealthResult {
  id: string;
  healthy: boolean;
  skills: number;
  commands: number;
  warnings: string[];
}

async function checkBackendHealth(
  backendConfig: BackendConfig,
  projectRoot: string
): Promise<BackendHealthResult> {
  const warnings: string[] = [];
  let skills = 0;
  let commands = 0;

  const skillsDir = path.join(projectRoot, backendConfig.skillsPath);
  try {
    const entries = await fsPromises.readdir(skillsDir, { withFileTypes: true });
    skills = entries.filter((e) => !e.isDirectory()).length;
  } catch {
    warnings.push(`Skills directory missing or unreadable: ${backendConfig.skillsPath}`);
  }

  if (backendConfig.supportsCommands && backendConfig.commandsPath) {
    let cmdDir = path.join(projectRoot, backendConfig.commandsPath);

    if (backendConfig.globalHomeEnv) {
      const envVal = process.env[backendConfig.globalHomeEnv];
      const base =
        envVal ??
        (backendConfig.fallbackGlobalPath ?? `~/.${backendConfig.id}/prompts`).replace(
          /^~/,
          os.homedir()
        );
      cmdDir = base;
    }

    try {
      const entries = await fsPromises.readdir(cmdDir, { withFileTypes: true });
      commands = entries.filter((e) => !e.isDirectory()).length;
    } catch {
      if (backendConfig.globalHomeEnv) {
        warnings.push(
          `Global commands path missing: ${cmdDir} (set $${backendConfig.globalHomeEnv} or create the directory)`
        );
      } else {
        warnings.push(`Commands directory missing: ${backendConfig.commandsPath}`);
      }
    }
  }

  if (backendConfig.id === "github-copilot") {
    warnings.push(
      "GitHub Copilot commands require an IDE extension (VS Code, JetBrains, Visual Studio)"
    );
  }

  const healthy = warnings.length === 0;
  return { id: backendConfig.id, healthy, skills, commands, warnings };
}

interface DiagnosticCheck {
  name: string;
  run: () => Promise<{ status: "pass" | "warn" | "fail"; message: string; resolution?: string }>;
}

async function fileExists(p: string): Promise<boolean> {
  return fsPromises
    .access(p)
    .then(() => true)
    .catch(() => false);
}

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Diagnostic mode for troubleshooting")
    .option("--tool <backend>", "Diagnose specific backend config issues")
    .option("--all", "Diagnose all backends configured in .bp.json")
    .option("--verbose", "Full diagnostic trace with timing")
    .option("--secret-scan", "Scan project files for leaked secrets")
    .option("--compliance-report [framework]", "Generate compliance gap report (gdpr, soc2, hipaa)")
    .option("--risk-audit", "Print risk tier classification and escalation runbook")
    .option("--env-template", "Generate .env.template from process.env references")
    .option("--json", "Output results as JSON")
    .option("--cost", "Include cost estimation report")
    .action(
      async (opts: {
        tool?: string;
        all?: boolean;
        verbose?: boolean;
        secretScan?: boolean;
        complianceReport?: string | boolean;
        riskAudit?: boolean;
        envTemplate?: boolean;
        json?: boolean;
        cost?: boolean;
      }) => {
        const cwd = process.cwd();
        const startTime = performance.now();

        // --- Per-backend diagnostics mode (--tool or --all) ---
        if (opts.all || (opts.tool && listBackendIds().includes(opts.tool))) {
          const projectConfig = loadProjectConfig(cwd);
          let backendsToCheck: string[];

          if (opts.all) {
            backendsToCheck =
              projectConfig?.backends ??
              ([projectConfig?.backend ?? "claude"].filter(Boolean) as string[]);
          } else {
            backendsToCheck = [opts.tool as string];
          }

          const results = await Promise.all(
            backendsToCheck.map(async (id) => {
              try {
                const config = getBackend(id);
                return await checkBackendHealth(config, cwd);
              } catch {
                return {
                  id,
                  healthy: false,
                  skills: 0,
                  commands: 0,
                  warnings: [`Unknown backend: ${id}`],
                } as BackendHealthResult;
              }
            })
          );

          if (opts.json) {
            console.log(JSON.stringify({ backends: results }, null, 2));
            if (!results.every((r) => r.healthy)) {
              throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
            }
            return;
          }

          for (const result of results) {
            const icon = result.healthy ? chalk.green("✔") : chalk.yellow("⚠");
            console.log(
              `${icon} ${chalk.bold(result.id)}: ${result.skills} skills, ${result.commands} commands`
            );
            for (const w of result.warnings) {
              console.log(chalk.yellow(`   ⚠ ${w}`));
            }
          }

          if (!results.every((r) => r.healthy)) {
            throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
          }
        }

        // --- v1 config deprecation warning ---
        {
          const bpJsonPath = path.join(cwd, ".bp.json");
          if (await fileExists(bpJsonPath)) {
            try {
              const raw = JSON.parse(await fsPromises.readFile(bpJsonPath, "utf-8")) as Record<
                string,
                unknown
              >;
              if ("backend" in raw && !("backends" in raw) && !opts.json) {
                console.warn(
                  chalk.yellow(
                    "[WARN] .bp.json uses deprecated `backend` field. Run: bp migrate config"
                  )
                );
              }
            } catch {
              // ignore
            }
          }
        }

        // --- Secret scan mode ---
        if (opts.secretScan) {
          console.log(chalk.bold.cyan("\n🔍 Scanning for secrets...\n"));
          const findings = await scanDirectory(cwd, { entropyEnabled: true });
          if (opts.json) {
            console.log(JSON.stringify(findings, null, 2));
          } else if (findings.length === 0) {
            console.log(chalk.green("✔ No secrets detected."));
          } else {
            for (const f of findings) {
              const color =
                f.severity === "error"
                  ? chalk.red
                  : f.severity === "warning"
                    ? chalk.yellow
                    : chalk.blue;
              console.log(color(`[${f.type}] ${f.file}:${f.line ?? 0}`));
              console.log(`  ${f.message}`);
              if (f.resolution) console.log(chalk.dim(`  → ${f.resolution}`));
              console.log();
            }
            console.log(
              chalk.red(`Found ${findings.length} finding(s). Rotate or remove before committing.`)
            );
          }
          if (findings.some((f) => f.severity === "error"))
            throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
        }

        // --- Compliance report mode ---
        if (opts.complianceReport !== undefined) {
          const framework =
            typeof opts.complianceReport === "string" ? opts.complianceReport : "gdpr";
          console.log(
            chalk.bold.cyan(`\n📋 Generating compliance gap report: ${framework.toUpperCase()}\n`)
          );
          try {
            const adapterForReport = await getAdapter(opts.tool ?? "claude");
            const irForReport = await adapterForReport.parse(cwd);
            const report = generateGapReport(irForReport, framework);
            if (opts.json) {
              console.log(JSON.stringify(report, null, 2));
            } else {
              console.log(formatGapReport(report));
            }
          } catch (e) {
            console.error(chalk.red(`Error: ${normalizeError(e).message}`));
            throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
          }
          return;
        }

        // --- Risk audit mode ---
        if (opts.riskAudit) {
          console.log(chalk.bold.cyan("\n⚠️  Risk Audit\n"));
          try {
            const fingerprint = await detect(cwd);
            const enriched = enrichFingerprint(fingerprint);
            const adapterForRisk = await getAdapter(opts.tool ?? "claude");
            const irForRisk = await adapterForRisk.parse(cwd);
            const tier = irForRisk.risk?.risk_tier ?? enriched.risk_tier ?? "medium";
            console.log(chalk.bold(`Risk Tier: ${tier.toUpperCase()}`));
            console.log();
            const runbook = generateEscalationRunbook(irForRisk);
            if (opts.json) {
              console.log(JSON.stringify({ risk_tier: tier, runbook }, null, 2));
            } else {
              console.log(runbook);
            }
          } catch (e) {
            console.error(chalk.red(`Error: ${normalizeError(e).message}`));
            throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
          }
          return;
        }

        // --- Env template mode ---
        if (opts.envTemplate) {
          console.log(chalk.bold.cyan("\n📄 Generating .env.template...\n"));
          const template = generateEnvTemplate(cwd);
          const outPath = path.join(cwd, ".env.template");
          await fsPromises.writeFile(outPath, template, "utf-8");
          if (opts.json) {
            console.log(JSON.stringify({ path: outPath, content: template }, null, 2));
          } else {
            console.log(chalk.green(`✔ Written to ${outPath}`));
            console.log(template);
          }
          return;
        }

        console.log(chalk.bold.cyan("\n🩺 blueprint doctor — Running Diagnostics\n"));

        // 1. Detect backend
        let backend = opts.tool;
        if (!backend) {
          try {
            await detect(cwd);
            if (await fileExists(path.join(cwd, ".claude"))) backend = "claude";
            else if (await fileExists(path.join(cwd, ".cursor"))) backend = "cursor";
            else if (await fileExists(path.join(cwd, "BLUEPRINT.md"))) backend = "generic";
            else backend = "claude";
          } catch {
            backend = "claude";
          }
        }

        const timings: Record<string, number> = {};

        const runCheckWithTiming = async (check: DiagnosticCheck) => {
          const start = performance.now();
          const res = await check.run();
          const end = performance.now();
          timings[check.name] = end - start;
          return res;
        };

        const checks: DiagnosticCheck[] = [
          {
            name: "spatial-anchor-presence",
            run: async () => {
              const anchorFiles = ["CLAUDE.md", "context.md", "BLUEPRINT.md"];
              const checks = await Promise.all(
                anchorFiles.map((f) => fileExists(path.join(cwd, f)).then((ok) => (ok ? f : null)))
              );
              const found = checks.find((f) => f !== null);
              if (found) {
                return { status: "pass" as const, message: `Spatial anchor found: "${found}"` };
              }
              return {
                status: "warn" as const,
                message:
                  "No spatial anchor file (CLAUDE.md / context.md / BLUEPRINT.md) found at project root.",
                resolution:
                  "Run 'bp init' to scaffold a new spatial anchor and blueprint governance structure.",
              };
            },
          },
          {
            name: "backend-manifest-validation",
            run: async () => {
              try {
                const fingerprint = await detect(cwd);
                const resolved = resolveTemplatePack(fingerprint, backend as string);
                if (resolved.manifest?.version) {
                  return {
                    status: "pass" as const,
                    message: `Manifest version ${resolved.manifest.version} parsed successfully for backend "${backend}"`,
                  };
                }
                return {
                  status: "fail" as const,
                  message: `Failed to retrieve version from manifest for backend "${backend}"`,
                  resolution:
                    "Verify that manifest.json is present and has a valid 'version' field.",
                };
              } catch (e) {
                return {
                  status: "fail" as const,
                  message: `Manifest validation error: ${normalizeError(e).message}`,
                  resolution: "Check if the template backend has a valid manifest.json",
                };
              }
            },
          },
          {
            name: "file-size-limits",
            run: async () => {
              try {
                const fingerprint = await detect(cwd);
                const resolved = resolveTemplatePack(fingerprint, backend as string);
                const manifest = resolved.manifest;

                const anchorLimit = manifest.max_file_sizes.anchor;

                const errors: string[] = [];

                for (const pattern of manifest.file_patterns.anchor) {
                  const p = path.join(cwd, pattern);
                  try {
                    const stat = await fsPromises.stat(p);
                    if (stat.size > anchorLimit) {
                      errors.push(
                        `Anchor file "${path.basename(p)}" size ${stat.size}B exceeds limit of ${anchorLimit}B.`
                      );
                    }
                  } catch {
                    // file absent — skip
                  }
                }

                if (errors.length > 0) {
                  return {
                    status: "fail" as const,
                    message: errors.join("\n"),
                    resolution:
                      "Refactor or split the oversized files to keep under tool size limits.",
                  };
                }

                return {
                  status: "pass" as const,
                  message: "All blueprint files are within maximum file size limits.",
                };
              } catch (_e) {
                return {
                  status: "pass" as const,
                  message:
                    "Skipping file size checks (no active manifest/scaffolded backend found).",
                };
              }
            },
          },
          {
            name: "frontmatter-conformance",
            run: async () => {
              try {
                const fingerprint = await detect(cwd);
                const resolved = resolveTemplatePack(fingerprint, backend as string);
                const manifest = resolved.manifest;

                const rulesDir = path.join(
                  cwd,
                  backend === "claude"
                    ? ".claude/rules"
                    : backend === "cursor"
                      ? ".cursor/rules"
                      : "rules"
                );

                if (await fileExists(rulesDir)) {
                  const files = (await fsPromises.readdir(rulesDir)).filter((f) =>
                    f.endsWith(".md")
                  );
                  for (const f of files) {
                    const content = await fsPromises.readFile(path.join(rulesDir, f), "utf-8");
                    const parsed = matter(content);
                    const data = parsed.data;
                    for (const req of manifest.frontmatter_schema.rules.required) {
                      if (data[req] === undefined) {
                        return {
                          status: "fail" as const,
                          message: `Rule file "${f}" is missing required frontmatter field: "${req}"`,
                          resolution: `Add the missing frontmatter field "${req}" to "${f}".`,
                        };
                      }
                    }
                  }
                }
                return {
                  status: "pass" as const,
                  message: "Frontmatter conformances verified successfully.",
                };
              } catch (_e) {
                return {
                  status: "pass" as const,
                  message: "Skipping frontmatter conformance (no active rules folder).",
                };
              }
            },
          },
          {
            name: "compliance-framework-mapping",
            run: async () => {
              try {
                const adapter = await getAdapter(backend as string);
                const ir = await adapter.parse(cwd);

                const report = generateComplianceReport(ir);
                const score = report.overall_score;

                if (score >= 70) {
                  return {
                    status: "pass" as const,
                    message: `Compliance score: ${score}% across ${report.frameworks.length} framework(s)`,
                  };
                } else if (score >= 40) {
                  const gaps = report.frameworks
                    .flatMap((f) => f.gaps)
                    .slice(0, 3)
                    .map((g) => g.description)
                    .join("; ");
                  return {
                    status: "warn" as const,
                    message: `Compliance score: ${score}% (below 70% target). Top gaps: ${gaps}`,
                    resolution: `Review and remediate compliance gaps. Run 'bp verify --level governance' for details.`,
                  };
                } else {
                  return {
                    status: "fail" as const,
                    message: `Critical compliance score: ${score}% (below 40% minimum)`,
                    resolution: `Immediate action required. Run 'bp verify --level governance' and address all gaps.`,
                  };
                }
              } catch (e) {
                return {
                  status: "warn" as const,
                  message: `Compliance check skipped: ${normalizeError(e).message}`,
                  resolution: "Ensure blueprint is valid and compliance.frameworks is configured.",
                };
              }
            },
          },
          {
            name: "risk-tier-classification",
            run: async () => {
              try {
                const fingerprint = await detect(cwd);
                const enriched = enrichFingerprint(fingerprint);
                const adapter = await getAdapter(backend as string);
                const ir = await adapter.parse(cwd);

                const irHasRiskTier = !!ir.risk?.risk_tier;
                const fpRiskTier = enriched.risk_tier;

                if (irHasRiskTier) {
                  return {
                    status: "pass" as const,
                    message: `Risk tier explicitly classified: ${ir.risk?.risk_tier}`,
                  };
                } else if (fpRiskTier === "high" || fpRiskTier === "critical") {
                  return {
                    status: "warn" as const,
                    message: `Blueprint does not define risk tier, but fingerprint detected ${fpRiskTier} risk`,
                    resolution: `Set ir.risk.risk_tier to match detected risk level (${fpRiskTier})`,
                  };
                } else {
                  return {
                    status: "pass" as const,
                    message: `Risk tier not explicitly set; fingerprint indicates ${fpRiskTier} risk (acceptable)`,
                  };
                }
              } catch (_e) {
                return {
                  status: "pass" as const,
                  message: "Risk tier classification check skipped (no risk signals detected).",
                };
              }
            },
          },
        ];

        // --- Cost report option ---
        if (opts.cost) {
          try {
            const { generateCostDashboard } = await import("../../observability/dashboard.js");
            const { BlueprintIRSchema } = await import("../../translator/ir.js");
            const bpPath = path.join(cwd, ".claude", "blueprint.json");
            if (await fileExists(bpPath)) {
              const raw = JSON.parse(await fsPromises.readFile(bpPath, "utf-8")) as unknown;
              const result = BlueprintIRSchema.safeParse(raw);
              if (result.success) {
                const dashboard = generateCostDashboard(result.data);
                console.log(chalk.bold.cyan("\n💵 Cost Estimation Report:"));
                console.log(dashboard);
              }
            } else {
              console.log(
                chalk.yellow(
                  "\n⚠ Cost report skipped: No blueprint found at .claude/blueprint.json"
                )
              );
            }
          } catch (e) {
            console.log(chalk.yellow(`\n⚠ Cost report failed: ${normalizeError(e).message}`));
          }
        }

        // Run all checks concurrently
        const checkResults = await Promise.all(
          checks.map(async (check) => ({ check, result: await runCheckWithTiming(check) }))
        );

        // Sort: fail first, then warn, then pass
        const statusOrder: Record<string, number> = { fail: 0, warn: 1, pass: 2 };
        checkResults.sort(
          (a, b) => (statusOrder[a.result.status] ?? 3) - (statusOrder[b.result.status] ?? 3)
        );

        let allPassed = true;

        for (const { check, result } of checkResults) {
          const nameText = chalk.bold(check.name.toUpperCase().padEnd(30));

          if (result.status === "pass") {
            console.log(`${chalk.green("✔ [ PASS ]")} ${nameText} ${result.message}`);
          } else if (result.status === "warn") {
            console.log(`${chalk.yellow("⚠ [ WARN ]")} ${nameText} ${result.message}`);
            if (result.resolution) {
              console.log(chalk.yellow(`           → Resolution: ${result.resolution}`));
            }
          } else {
            allPassed = false;
            console.log(`${chalk.red("✘ [ FAIL ]")} ${nameText} ${result.message}`);
            if (result.resolution) {
              console.log(chalk.red(`           → Resolution: ${result.resolution}`));
            }
          }
        }

        if (opts.verbose) {
          console.log(chalk.bold.cyan("\n⏱ Timing Breakdown (Verbose Mode):"));
          for (const [name, time] of Object.entries(timings)) {
            console.log(`  - ${name.padEnd(30)}: ${time.toFixed(2)}ms`);
          }
          const total = performance.now() - startTime;
          console.log(chalk.cyan(`  - TOTAL RUNTIME                 : ${total.toFixed(2)}ms`));
        }

        console.log();

        if (allPassed) {
          console.log(
            chalk.bold.green("✔ Diagnostics completed successfully. Everything looks healthy!")
          );
          return;
        } else {
          console.log(
            chalk.bold.red(
              "✘ Diagnostics completed with failures. Please review and fix the issues above."
            )
          );
          throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
        }
      }
    );
}
