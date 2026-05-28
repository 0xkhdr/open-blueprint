# Domain: Enterprise Governance
**Priority:** P1 · **Status:** ⚠️ PARTIAL — Validation done, secret scan + compliance gap missing · **Dependencies:** `01-IR-SCHEMA-FOUNDATION.md`, `03-DETECTOR-ENHANCEMENT.md`
**Agent Boundary:** Governance validation exists. Your job is post-generation secret scanning, compliance gap reporting, and enhanced `bp doctor` output.

---

## 1. Current State (Verified from Repo)

Already implemented:
- ✅ `validateGovernance()` in `src/validator/index.ts` — validates all enterprise layers
- ✅ `validateIdentity()`, `validateAudit()`, `validateCompliance()`, `validateRisk()` in `src/validator/layers.js`
- ✅ `validateRBAC()` in `src/validator/rbac.js`
- ✅ `validateOrchestration()` in `src/validator/layers.js`
- ✅ IR schemas for all enterprise layers

**Missing:**
- ❌ Post-generation secret scanning
- ❌ Compliance gap report generator
- ❌ Enhanced `bp doctor --compliance-report`
- ❌ `.env.template` generator
- ❌ Escalation runbook generator

---

## 2. Implementation Tasks

### Task 6.1: Secret Scanning Engine
Create `src/enterprise/secrets.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: "critical" | "high" | "medium";
  example: string;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key ID",
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
    example: "AKIAIOSFODNN7EXAMPLE",
  },
  {
    name: "AWS Secret Access Key",
    pattern: /[0-9a-zA-Z/+]{40}/g,
    severity: "critical",
    example: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  },
  {
    name: "GitHub Personal Access Token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{36}/g,
    severity: "critical",
    example: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  {
    name: "JWT Token",
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    severity: "high",
    example: "eyJhbGciOiJIUzI1NiIs...",
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: "critical",
    example: "-----BEGIN RSA PRIVATE KEY-----",
  },
  {
    name: "Slack Token",
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}(-[a-zA-Z0-9]{24})?/g,
    severity: "high",
    example: "xoxb-your-slack-token-here",
  },
  {
    name: "Generic API Key",
    pattern: /[a-zA-Z_][a-zA-Z0-9_]*_[kK]ey\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/g,
    severity: "medium",
    example: "api_key = 'abcdef1234567890abcdef1234567890'",
  },
  {
    name: "Database Connection String",
    pattern: /(mongodb|mysql|postgres|redis)://[^\s"']+/gi,
    severity: "high",
    example: "mongodb://user:pass@host:27017/db",
  },
];

export interface SecretFinding {
  pattern: string;
  file: string;
  line: number;
  column: number;
  match: string;
  severity: "critical" | "high" | "medium";
}

export function scanForSecrets(projectRoot: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const files = collectTextFiles(projectRoot);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      for (const secret of SECRET_PATTERNS) {
        const matches = line.matchAll(secret.pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            findings.push({
              pattern: secret.name,
              file: path.relative(projectRoot, file),
              line: lineNum + 1,
              column: match.index + 1,
              match: match[0],
              severity: secret.severity,
            });
          }
        }
      }
    }
  }

  return findings;
}

function collectTextFiles(root: string): string[] {
  // Skip node_modules, .git, binary files
  const extensions = new Set([".md", ".json", ".yaml", ".yml", ".ts", ".js", ".py", ".go", ".rs", ".java", ".rb"]);
  // Use fast-glob or simple walk
  const files: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
        walk(fullPath);
      } else if (extensions.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}
```

### Task 6.2: `.env.template` Generator
Create `src/enterprise/env-template.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

export interface EnvVariable {
  key: string;
  description: string;
  required: boolean;
  example?: string;
}

export function generateEnvTemplate(projectRoot: string): string {
  const vars = detectEnvVariables(projectRoot);

  let template = "# Environment Variables Template\n";
  template += "# Copy to .env and fill in values\n";
  template += "# DO NOT commit .env to version control\n\n";

  for (const v of vars) {
    template += `# ${v.description}\n`;
    if (v.required) {
      template += `${v.key}=\n`;
    } else {
      template += `# ${v.key}=${v.example || ""}\n`;
    }
    template += "\n";
  }

  return template;
}

function detectEnvVariables(root: string): EnvVariable[] {
  const vars: EnvVariable[] = [];

  // Scan for process.env references
  const files = collectSourceFiles(root);
  const envPattern = /process\.env\.(\w+)|process\.env\[["'](\w+)["']\]/g;
  const seen = new Set<string>();

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let match;
    while ((match = envPattern.exec(content)) !== null) {
      const key = match[1] || match[2];
      if (!seen.has(key)) {
        seen.add(key);
        vars.push({
          key,
          description: inferDescription(key),
          required: !content.includes(`${key} ||`),
        });
      }
    }
  }

  return vars;
}

function inferDescription(key: string): string {
  const descriptions: Record<string, string> = {
    PORT: "Server port number",
    NODE_ENV: "Environment mode (development, production, test)",
    DATABASE_URL: "Database connection string",
    API_KEY: "External API authentication key",
    JWT_SECRET: "Secret key for JWT token signing",
    REDIS_URL: "Redis connection string",
    LOG_LEVEL: "Logging verbosity level",
  };
  return descriptions[key] || `Configuration for ${key}`;
}
```

### Task 6.3: Compliance Gap Report Generator
Create `src/enterprise/compliance-report.ts`:

```typescript
import type { BlueprintIR, Compliance } from "../translator/ir.js";

export interface GapReport {
  framework: string;
  coverage_percent: number;
  gaps: Array<{
    control_id: string;
    description: string;
    status: "missing" | "partial" | "manual";
    matching_rules: string[];
    recommendation: string;
  }>;
  summary: {
    total_controls: number;
    automated: number;
    manual: number;
    missing: number;
  };
}

export function generateGapReport(
  ir: BlueprintIR,
  framework: string
): GapReport {
  const controls = getFrameworkControls(framework);
  const gaps = [];
  let automated = 0;
  let manual = 0;
  let missing = 0;

  for (const control of controls) {
    const matchingRules = ir.rules.filter(r => 
      r.tags?.some(t => t.toLowerCase().includes(control.id.toLowerCase())) ||
      r.action.toLowerCase().includes(control.keyword.toLowerCase())
    );

    if (matchingRules.length === 0) {
      missing++;
      gaps.push({
        control_id: control.id,
        description: control.description,
        status: "missing",
        matching_rules: [],
        recommendation: `Add rule covering: ${control.description}`,
      });
    } else if (matchingRules.some(r => r.rationale)) {
      automated++;
    } else {
      manual++;
      gaps.push({
        control_id: control.id,
        description: control.description,
        status: "manual",
        matching_rules: matchingRules.map(r => r.id),
        recommendation: `Add rationale to rule(s): ${matchingRules.map(r => r.id).join(", ")}`,
      });
    }
  }

  const total = controls.length;
  const coverage = total > 0 ? ((automated + manual) / total) * 100 : 0;

  return {
    framework,
    coverage_percent: Math.round(coverage * 100) / 100,
    gaps,
    summary: {
      total_controls: total,
      automated,
      manual,
      missing,
    },
  };
}

function getFrameworkControls(framework: string): Array<{ id: string; description: string; keyword: string }> {
  const frameworks: Record<string, Array<{ id: string; description: string; keyword: string }>> = {
    "gdpr": [
      { id: "art-5-1-c", description: "Data minimization", keyword: "minimize" },
      { id: "art-7", description: "Conditions for consent", keyword: "consent" },
      { id: "art-17", description: "Right to erasure", keyword: "delete" },
      { id: "art-25", description: "Data protection by design", keyword: "privacy" },
      { id: "art-32", description: "Security of processing", keyword: "security" },
    ],
    "soc2": [
      { id: "CC6.1", description: "Logical access security", keyword: "access" },
      { id: "CC6.2", description: "Access removal", keyword: "remove" },
      { id: "CC7.1", description: "System operations monitoring", keyword: "monitor" },
      { id: "CC7.2", description: "System operations evaluation", keyword: "evaluate" },
    ],
    "hipaa": [
      { id: "164.312(a)", description: "Access control", keyword: "access" },
      { id: "164.312(b)", description: "Audit controls", keyword: "audit" },
      { id: "164.312(c)", description: "Integrity", keyword: "integrity" },
      { id: "164.312(d)", description: "Person authentication", keyword: "authenticate" },
    ],
  };

  return frameworks[framework.toLowerCase()] || [];
}
```

### Task 6.4: Enhanced `bp doctor`
Update `src/cli/commands/doctor.ts` (or create if missing):
- [ ] Add `--compliance-report` flag
- [ ] Add `--risk-audit` flag
- [ ] Add `--secret-scan` flag
- [ ] Integrate `scanForSecrets()`, `generateGapReport()`, `generateEnvTemplate()`

### Task 6.5: Escalation Runbook Generator
Create `src/enterprise/runbooks.ts`:

```typescript
import type { BlueprintIR } from "../translator/ir.js";

export function generateEscalationRunbook(ir: BlueprintIR): string {
  const tier = ir.risk?.risk_tier || "medium";

  let runbook = `# Escalation Runbook: ${ir.spatial_anchor.project_name}\n`;
  runbook += `**Risk Tier:** ${tier}\n`;
  runbook += `**Generated:** ${new Date().toISOString()}\n\n`;

  runbook += "## Escalation Matrix\n\n";
  runbook += "| Condition | Action | Contact | Rollback |\n";
  runbook += "|-----------|--------|---------|----------|\n";

  if (tier === "critical") {
    runbook += "| Any policy violation | Block + Escalate | CISO | Emergency rollback |\n";
    runbook += "| Budget overrun > 100% | Block + Alert | Finance + Security | Manual approval |\n";
    runbook += "| Secret leak detected | Block + Rotate | Security team | Immediate rotation |\n";
  } else if (tier === "high") {
    runbook += "| Hard rule violation | Block + Alert | Security team | Manual approval |\n";
    runbook += "| Budget overrun > 80% | Alert | Team lead | Auto |\n";
    runbook += "| Secret leak detected | Alert + Rotate | Security team | Scheduled rotation |\n";
  } else {
    runbook += "| Rule violation | Log | — | Auto |\n";
    runbook += "| Budget overrun > 100% | Alert | Team lead | Auto |\n";
  }

  runbook += "\n## Emergency Contacts\n\n";
  runbook += "- **Security:** security@company.com\n";
  runbook += "- **On-call:** oncall@company.com\n";

  return runbook;
}
```

---

## 3. Acceptance Criteria

- [ ] `scanForSecrets()` detects AWS keys, JWTs, private keys, DB connection strings
- [ ] Secret scan false positive rate < 5%
- [ ] `.env.template` generated from `process.env` references
- [ ] Compliance gap report generated for GDPR, SOC2, HIPAA
- [ ] Gap report shows coverage %, missing controls, recommendations
- [ ] `bp doctor --compliance-report` outputs gap report
- [ ] `bp doctor --secret-scan` outputs secret findings
- [ ] `bp doctor --risk-audit` outputs risk classification + runbook
- [ ] Escalation runbook generated per risk tier
- [ ] 50+ new tests, all passing
- [ ] Coverage for `src/enterprise/` ≥ 95%

---

## 4. Cross-References

| Concern | File | Status |
|---------|------|--------|
| IR schema for enterprise layers | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Risk tier from detector | `03-DETECTOR-ENHANCEMENT.md` | ⚠️ Partial |
| Validator for enterprise layers | `04-VALIDATOR-ENHANCEMENT.md` | ⚠️ Partial |
| Template packs for compliance | `05-TEMPLATER-ENHANCEMENT.md` | ⚠️ Not started |

---

*Domain Spec: Enterprise Governance · open-blueprint v2.0*
