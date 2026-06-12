/**
 * Shared SARIF 2.1.0 serializer (Stage 6 §2).
 *
 * Two producers, one module: `toSarif` converts raw `ValidationError`s
 * (`bp verify --format sarif`), `reportToSarif` converts a GovernanceReport
 * so GitHub code scanning annotates PRs per bp rule — one `rules[]` entry per
 * rule id carrying rationale/severity/pack/framework, one `results[]` entry
 * per violation located at the violating evidence (falling back to the rule
 * file itself).
 */

import type { ValidationError } from "../validator/structural.js";
import type { GovernanceReport } from "./model.js";

export const SARIF_SCHEMA_URI =
  "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region?: { startLine: number };
  };
}

export interface SarifResult {
  ruleId: string;
  message: { text: string };
  level: "error" | "warning" | "note";
  locations: SarifLocation[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription?: { text: string };
  fullDescription?: { text: string };
  help?: { text: string };
  properties?: Record<string, unknown>;
}

export interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: Array<{
    tool: {
      driver: { name: string; version: string; informationUri?: string; rules: SarifRule[] };
    };
    results: SarifResult[];
  }>;
}

function severityToLevel(severity: string): "error" | "warning" | "note" {
  if (severity === "error") return "error";
  if (severity === "warning") return "warning";
  return "note";
}

function location(uri: string, line?: number): SarifLocation {
  return {
    physicalLocation: {
      artifactLocation: { uri: uri.replace(/\\/g, "/") },
      ...(line !== undefined ? { region: { startLine: line } } : {}),
    },
  };
}

function sarifLog(rules: SarifRule[], results: SarifResult[], toolVersion: string): SarifLog {
  return {
    $schema: SARIF_SCHEMA_URI,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "bp",
            version: toolVersion,
            informationUri: "https://github.com/0xkhdr/open-blueprint",
            rules,
          },
        },
        results,
      },
    ],
  };
}

/** ValidationError stream → SARIF, one rule per finding type (`bp verify`). */
export function toSarif(errors: ValidationError[], toolVersion = "1.0.0"): SarifLog {
  const ruleIds = [...new Set(errors.map((e) => e.type))];
  const rules: SarifRule[] = ruleIds.map((id) => ({ id, name: id }));

  const results: SarifResult[] = errors.map((e) => ({
    ruleId: e.type,
    message: { text: e.message + (e.resolution ? ` Resolution: ${e.resolution}` : "") },
    level: severityToLevel(e.severity),
    locations: [location(e.file, e.line)],
  }));

  return sarifLog(rules, results, toolVersion);
}

/**
 * GovernanceReport → SARIF: per-bp-rule `rules[]` and per-violation
 * `results[]` (`bp report --sarif`). Manual/passing rules appear in `rules[]`
 * only, so code scanning knows the full rule universe without noise results.
 */
export function reportToSarif(report: GovernanceReport, toolVersion = "1.0.0"): SarifLog {
  const seen = new Set<string>();
  const rules: SarifRule[] = [];
  for (const rule of report.rules) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    const pack = report.packs.find((p) => p.id === rule.pack?.id);
    rules.push({
      id: rule.id,
      name: rule.id,
      shortDescription: { text: `bp governance rule '${rule.id}' (${rule.severity})` },
      ...(rule.detail ? { fullDescription: { text: rule.detail } } : {}),
      properties: {
        severity: rule.severity,
        enforcement: rule.enforcement,
        ...(rule.pack ? { pack: rule.pack.id, packVersion: rule.pack.version } : {}),
        ...(pack?.framework ? { framework: pack.framework } : {}),
      },
    });
  }

  const results: SarifResult[] = [];
  for (const rule of report.rules) {
    if (rule.status !== "fail" && rule.status !== "invalid") continue;
    const level: SarifResult["level"] =
      rule.status === "invalid" || rule.severity === "hard" ? "error" : "warning";
    const message =
      rule.status === "invalid"
        ? `Rule '${rule.id}' has an invalid check: ${rule.detail ?? "malformed check"}`
        : `Rule '${rule.id}' violated${rule.detail ? `: ${rule.detail}` : ""}`;
    const locations =
      rule.evidence && rule.evidence.length > 0
        ? rule.evidence.map((e) => location(e.file, e.line))
        : [location(rule.file)];
    results.push({ ruleId: rule.id, message: { text: message }, level, locations });
  }

  return sarifLog(rules, results, toolVersion);
}
