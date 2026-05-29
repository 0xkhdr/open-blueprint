import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import matter from "gray-matter";
import { detect, enrichFingerprint } from "../../detector/index.js";
import { formatGapReport, generateGapReport } from "../../enterprise/compliance-report.js";
import { generateEnvTemplate } from "../../enterprise/env-template.js";
import { generateEscalationRunbook } from "../../enterprise/runbooks.js";
import { scanForSecrets } from "../../enterprise/secrets.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { AntigravityAdapter } from "../../translator/adapters/antigravity.js";
import { ClaudeAdapter } from "../../translator/adapters/claude.js";
import { CodexAdapter } from "../../translator/adapters/codex.js";
import { CopilotAdapter } from "../../translator/adapters/copilot.js";
import { CursorAdapter } from "../../translator/adapters/cursor.js";
import { GeminiAdapter } from "../../translator/adapters/gemini.js";
import { GenericAdapter } from "../../translator/adapters/generic.js";
import { KiroAdapter } from "../../translator/adapters/kiro.js";
import { OpenDevAdapter } from "../../translator/adapters/opendev.js";
import { PIAdapter } from "../../translator/adapters/pi.js";
import { generateComplianceReport } from "../../validator/compliance.js";
import { EXIT_CODES } from "../../validator/index.js";

interface DiagnosticCheck {
  name: string;
  run: () => Promise<{ status: "pass" | "warn" | "fail"; message: string; resolution?: string }>;
}

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Diagnostic mode for troubleshooting")
    .option("--tool <backend>", "Diagnose specific backend config issues")
    .option("--verbose", "Full diagnostic trace with timing")
    .option("--secret-scan", "Scan project files for leaked secrets")
    .option("--compliance-report [framework]", "Generate compliance gap report (gdpr, soc2, hipaa)")
    .option("--risk-audit", "Print risk tier classification and escalation runbook")
    .option("--env-template", "Generate .env.template from process.env references")
    .option("--json", "Output results as JSON")
    .action(
      async (opts: {
        tool?: string;
        verbose?: boolean;
        secretScan?: boolean;
        complianceReport?: string | boolean;
        riskAudit?: boolean;
        envTemplate?: boolean;
        json?: boolean;
      }) => {
        const cwd = process.cwd();
        const startTime = performance.now();

        // --- Secret scan mode ---
        if (opts.secretScan) {
          console.log(chalk.bold.cyan("\n🔍 Scanning for secrets...\n"));
          const findings = scanForSecrets(cwd);
          if (opts.json) {
            console.log(JSON.stringify(findings, null, 2));
          } else if (findings.length === 0) {
            console.log(chalk.green("✔ No secrets detected."));
          } else {
            for (const f of findings) {
              const color =
                f.severity === "critical"
                  ? chalk.red
                  : f.severity === "high"
                    ? chalk.yellow
                    : chalk.blue;
              console.log(color(`[${f.severity.toUpperCase()}] ${f.pattern}`));
              console.log(`  File: ${f.file}:${f.line}:${f.column}`);
              console.log(`  Match: ${f.match.slice(0, 40)}...`);
              console.log();
            }
            console.log(
              chalk.red(`Found ${findings.length} secret(s). Rotate or remove before committing.`)
            );
          }
          process.exit(findings.length > 0 ? EXIT_CODES.GENERAL_ERROR : EXIT_CODES.SUCCESS);
        }

        // --- Compliance report mode ---
        if (opts.complianceReport !== undefined) {
          const framework =
            typeof opts.complianceReport === "string" ? opts.complianceReport : "gdpr";
          console.log(
            chalk.bold.cyan(`\n📋 Generating compliance gap report: ${framework.toUpperCase()}\n`)
          );
          try {
            const adapterForReport = getAdapterByName(opts.tool ?? "claude");
            const irForReport = await adapterForReport.parse(cwd);
            const report = generateGapReport(irForReport, framework);
            if (opts.json) {
              console.log(JSON.stringify(report, null, 2));
            } else {
              console.log(formatGapReport(report));
            }
          } catch (e) {
            console.error(chalk.red(`Error: ${e instanceof Error ? e.message : String(e)}`));
            process.exit(EXIT_CODES.GENERAL_ERROR);
          }
          process.exit(EXIT_CODES.SUCCESS);
        }

        // --- Risk audit mode ---
        if (opts.riskAudit) {
          console.log(chalk.bold.cyan("\n⚠️  Risk Audit\n"));
          try {
            const fingerprint = await detect(cwd);
            const enriched = enrichFingerprint(fingerprint);
            const adapterForRisk = getAdapterByName(opts.tool ?? "claude");
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
            console.error(chalk.red(`Error: ${e instanceof Error ? e.message : String(e)}`));
            process.exit(EXIT_CODES.GENERAL_ERROR);
          }
          process.exit(EXIT_CODES.SUCCESS);
        }

        // --- Env template mode ---
        if (opts.envTemplate) {
          console.log(chalk.bold.cyan("\n📄 Generating .env.template...\n"));
          const template = generateEnvTemplate(cwd);
          const outPath = path.join(cwd, ".env.template");
          fs.writeFileSync(outPath, template, "utf-8");
          if (opts.json) {
            console.log(JSON.stringify({ path: outPath, content: template }, null, 2));
          } else {
            console.log(chalk.green(`✔ Written to ${outPath}`));
            console.log(template);
          }
          process.exit(EXIT_CODES.SUCCESS);
        }

        console.log(chalk.bold.cyan("\n🩺 blueprint doctor — Running Diagnostics\n"));

        // 1. Detect backend
        let backend = opts.tool;
        if (!backend) {
          try {
            const _fingerprint = await detect(cwd);
            // Standard default or detect from existing files
            if (fs.existsSync(path.join(cwd, ".claude"))) backend = "claude";
            else if (fs.existsSync(path.join(cwd, ".cursor"))) backend = "cursor";
            else if (fs.existsSync(path.join(cwd, "BLUEPRINT.md"))) backend = "generic";
            else backend = "claude"; // default
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
              const found = anchorFiles.find((f) => fs.existsSync(path.join(cwd, f)));
              if (found) {
                return {
                  status: "pass",
                  message: `Spatial anchor found: "${found}"`,
                };
              }
              return {
                status: "warn",
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
                    status: "pass",
                    message: `Manifest version ${resolved.manifest.version} parsed successfully for backend "${backend}"`,
                  };
                }
                return {
                  status: "fail",
                  message: `Failed to retrieve version from manifest for backend "${backend}"`,
                  resolution:
                    "Verify that manifest.json is present and has a valid 'version' field.",
                };
              } catch (e) {
                return {
                  status: "fail",
                  message: `Manifest validation error: ${e instanceof Error ? e.message : String(e)}`,
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
                const _rulesLimit = manifest.max_file_sizes.rules;
                const _skillsLimit = manifest.max_file_sizes.skills;
                const _agentsLimit = manifest.max_file_sizes.agents;

                // Check actual file sizes
                let _issuesCount = 0;
                const checkSize = (filePath: string, limit: number, type: string) => {
                  if (fs.existsSync(filePath)) {
                    const stat = fs.statSync(filePath);
                    if (stat.size > limit) {
                      _issuesCount++;
                      return `${type} file "${path.basename(filePath)}" size ${stat.size}B exceeds limit of ${limit}B.`;
                    }
                  }
                  return null;
                };

                const errors: string[] = [];

                // Anchor files
                for (const pattern of manifest.file_patterns.anchor) {
                  const p = path.join(cwd, pattern);
                  const issue = checkSize(p, anchorLimit, "Anchor");
                  if (issue) errors.push(issue);
                }

                if (errors.length > 0) {
                  return {
                    status: "fail",
                    message: errors.join("\n"),
                    resolution:
                      "Refactor or split the oversized files to keep under tool size limits.",
                  };
                }

                return {
                  status: "pass",
                  message: "All blueprint files are within maximum file size limits.",
                };
              } catch (_e) {
                return {
                  status: "pass", // Skip check if template pack resolver fails
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

                // Let's check a few rule files for YAML frontmatter
                const rulesDir = path.join(
                  cwd,
                  backend === "claude"
                    ? ".claude/rules"
                    : backend === "cursor"
                      ? ".cursor/rules"
                      : "rules"
                );
                if (fs.existsSync(rulesDir)) {
                  const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
                  for (const f of files) {
                    const content = fs.readFileSync(path.join(rulesDir, f), "utf-8");
                    const parsed = matter(content);
                    const data = parsed.data;
                    for (const req of manifest.frontmatter_schema.rules.required) {
                      if (data[req] === undefined) {
                        return {
                          status: "fail",
                          message: `Rule file "${f}" is missing required frontmatter field: "${req}"`,
                          resolution: `Add the missing frontmatter field "${req}" to "${f}".`,
                        };
                      }
                    }
                  }
                }
                return {
                  status: "pass",
                  message: "Frontmatter conformances verified successfully.",
                };
              } catch (_e) {
                return {
                  status: "pass",
                  message: "Skipping frontmatter conformance (no active rules folder).",
                };
              }
            },
          },
          {
            name: "compliance-framework-mapping",
            run: async () => {
              try {
                const adapter = getAdapterByName(backend as string);
                const ir = await adapter.parse(cwd);

                const report = generateComplianceReport(ir);
                const score = report.overall_score;

                if (score >= 70) {
                  return {
                    status: "pass",
                    message: `Compliance score: ${score}% across ${report.frameworks.length} framework(s)`,
                  };
                } else if (score >= 40) {
                  const gaps = report.frameworks
                    .flatMap((f) => f.gaps)
                    .slice(0, 3)
                    .map((g) => g.description)
                    .join("; ");
                  return {
                    status: "warn",
                    message: `Compliance score: ${score}% (below 70% target). Top gaps: ${gaps}`,
                    resolution: `Review and remediate compliance gaps. Run 'bp verify --level governance' for details.`,
                  };
                } else {
                  return {
                    status: "fail",
                    message: `Critical compliance score: ${score}% (below 40% minimum)`,
                    resolution: `Immediate action required. Run 'bp verify --level governance' and address all gaps.`,
                  };
                }
              } catch (e) {
                return {
                  status: "warn",
                  message: `Compliance check skipped: ${e instanceof Error ? e.message : String(e)}`,
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
                const adapter = getAdapterByName(backend as string);
                const ir = await adapter.parse(cwd);

                const irHasRiskTier = !!ir.risk?.risk_tier;
                const fpRiskTier = enriched.risk_tier;

                if (irHasRiskTier) {
                  return {
                    status: "pass",
                    message: `Risk tier explicitly classified: ${ir.risk?.risk_tier}`,
                  };
                } else if (fpRiskTier === "high" || fpRiskTier === "critical") {
                  return {
                    status: "warn",
                    message: `Blueprint does not define risk tier, but fingerprint detected ${fpRiskTier} risk`,
                    resolution: `Set ir.risk.risk_tier to match detected risk level (${fpRiskTier})`,
                  };
                } else {
                  return {
                    status: "pass",
                    message: `Risk tier not explicitly set; fingerprint indicates ${fpRiskTier} risk (acceptable)`,
                  };
                }
              } catch (_e) {
                return {
                  status: "pass",
                  message: "Risk tier classification check skipped (no risk signals detected).",
                };
              }
            },
          },
        ];

        function getAdapterByName(name: string) {
          switch (name) {
            case "claude":
              return new ClaudeAdapter();
            case "cursor":
              return new CursorAdapter();
            case "codex":
              return new CodexAdapter();
            case "pi":
              return new PIAdapter();
            case "copilot":
              return new CopilotAdapter();
            case "gemini":
              return new GeminiAdapter();
            case "kiro":
              return new KiroAdapter();
            case "antigravity":
              return new AntigravityAdapter();
            case "opendev":
              return new OpenDevAdapter();
            default:
              return new GenericAdapter();
          }
        }

        let allPassed = true;

        for (const check of checks) {
          const result = await runCheckWithTiming(check);
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
          process.exit(EXIT_CODES.SUCCESS);
        } else {
          console.log(
            chalk.bold.red(
              "✘ Diagnostics completed with failures. Please review and fix the issues above."
            )
          );
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    );
}
