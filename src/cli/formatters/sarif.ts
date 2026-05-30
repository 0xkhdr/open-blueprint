import type { ValidationError } from "../../validator/structural.js";

const SARIF_SCHEMA = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region?: { startLine: number };
  };
}

interface SarifResult {
  ruleId: string;
  message: { text: string };
  level: "error" | "warning" | "note";
  locations: SarifLocation[];
}

interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: Array<{
    tool: { driver: { name: string; version: string; rules: Array<{ id: string; name: string }> } };
    results: SarifResult[];
  }>;
}

function severityToLevel(severity: string): "error" | "warning" | "note" {
  if (severity === "error") return "error";
  if (severity === "warning") return "warning";
  return "note";
}

export function toSarif(
  errors: ValidationError[],
  toolVersion = "1.0.0"
): SarifLog {
  const ruleIds = [...new Set(errors.map((e) => e.type))];
  const rules = ruleIds.map((id) => ({ id, name: id }));

  const results: SarifResult[] = errors.map((e) => ({
    ruleId: e.type,
    message: { text: e.message + (e.resolution ? ` Resolution: ${e.resolution}` : "") },
    level: severityToLevel(e.severity),
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: e.file.replace(/\\/g, "/") },
          ...(e.line !== undefined ? { region: { startLine: e.line } } : {}),
        },
      },
    ],
  }));

  return {
    $schema: SARIF_SCHEMA,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: { name: "bp", version: toolVersion, rules },
        },
        results,
      },
    ],
  };
}
