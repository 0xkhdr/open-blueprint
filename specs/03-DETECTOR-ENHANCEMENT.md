# Domain: Detector Engine Enhancement
**Priority:** P1 · **Status:** ⚠️ PARTIAL — Risk scoring done, enterprise signals missing · **Dependencies:** `01-IR-SCHEMA-FOUNDATION.md`
**Agent Boundary:** The base detector and risk scoring are complete. Your job is to add enterprise signal detection and verify accuracy.

---

## 1. Current State (Verified from Repo)

`src/detector/index.ts` already implements:
- ✅ `EnhancedFingerprint` interface with `risk_tier`, `suggested_approval_mode`, `estimated_monthly_tokens`
- ✅ `detectRiskTier()` — weighted scoring (external APIs +2, secrets +2, auth +2, docker +1)
- ✅ `detectApprovalMode()` — critical→read-only, high→confirm, medium/low→auto
- ✅ `estimateMonthlyTokens()` — heuristic based on src dirs, frameworks, project type
- ✅ `enrichFingerprint()` — combines base fingerprint with enhancements

**Missing:** Enterprise signal detection (RBAC, compliance docs, audit logging, DLP scanners)

---

## 2. Implementation Tasks

### Task 3.1: Enterprise Signals Detection
Create `src/detector/enterprise-signals.ts`:

```typescript
export interface EnterpriseSignals {
  has_rbac_config: boolean;
  has_compliance_docs: boolean;
  has_audit_logging: boolean;
  has_dlp_scanner: boolean;
}

export function detectEnterpriseSignals(root: string): EnterpriseSignals {
  return {
    has_rbac_config: detectRBAC(root),
    has_compliance_docs: detectComplianceDocs(root),
    has_audit_logging: detectAuditLogging(root),
    has_dlp_scanner: detectDLPScanner(root),
  };
}

function detectRBAC(root: string): boolean {
  const signals = [
    "auth0.config", "keycloak.json", "casbin", "IAM",
    "rbac", "roles", "permissions", "policy",
  ];
  return signals.some(s => fileExists(path.join(root, s)) || 
    globSync(`${root}/**/*${s}*`, { onlyFiles: true }).length > 0);
}

function detectComplianceDocs(root: string): boolean {
  const patterns = [
    "GDPR*", "SOC2*", "HIPAA*", "PCI*", "COMPLIANCE*",
    "privacy-policy*", "data-processing*",
  ];
  return patterns.some(p => globSync(path.join(root, p)).length > 0);
}

function detectAuditLogging(root: string): boolean {
  // Check package.json deps
  const pkgPath = path.join(root, "package.json");
  if (fileExists(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const auditLibs = ["pino", "winston", "bunyan", "morgan", "datadog", "newrelic"];
    if (auditLibs.some(lib => lib in deps)) return true;
  }
  // Check for config files
  const configFiles = [
    "audit.log", "cloudwatch.json", "datadog.yaml", ".newrelic.js",
  ];
  return configFiles.some(f => fileExists(path.join(root, f)));
}

function detectDLPScanner(root: string): boolean {
  const precommitPath = path.join(root, ".pre-commit-config.yaml");
  if (!fileExists(precommitPath)) return false;
  const content = fs.readFileSync(precommitPath, "utf-8");
  const dlpTools = ["detect-secrets", "git-secrets", "trufflehog", "gitleaks"];
  return dlpTools.some(tool => content.includes(tool));
}
```

### Task 3.2: Integrate Enterprise Signals into Fingerprint
Update `src/detector/index.ts`:
- [ ] Add `enterprise_signals` field to `EnhancedFingerprint`
- [ ] Call `detectEnterpriseSignals()` in `enrichFingerprint()`
- [ ] Update `FingerprintSchema` in `src/detector/fingerprint.ts` to include enterprise signals

### Task 3.3: Map Enterprise Signals to IR
Update detector output pipeline:
- [ ] `has_rbac_config` → hint for `ir.identity` layer
- [ ] `has_compliance_docs` → hint for `ir.compliance` layer
- [ ] `has_audit_logging` → hint for `ir.audit` layer
- [ ] `has_dlp_scanner` → security confidence boost

### Task 3.4: Risk Scoring Accuracy Tests
Create `tests/unit/detector/risk-scoring.test.ts`:
- [ ] Test all 4 risk tiers with controlled signal combinations
- [ ] Test approval mode inference per tier
- [ ] Test token estimation accuracy (±30% tolerance on known repos)
- [ ] Test enterprise signal detection on mock repos

### Task 3.5: Enhanced Signal Detection
Add missing signals to `detectRiskTier()`:
- [ ] `has_data_sensitive` — check for encryption libs (crypto, bcrypt, hash)
- [ ] `has_financial_data` — check for payment libs (stripe, paypal)
- [ ] `has_pii` — check for GDPR/HIPAA refs, email regex patterns
- [ ] `has_encryption` — check for tls, ssl, cipher keywords

---

## 3. Acceptance Criteria

- [ ] `EnhancedFingerprint` includes `enterprise_signals` with 4 boolean fields
- [ ] Enterprise signals detected from file existence heuristics (no shell/network)
- [ ] Risk tier detection accuracy ≥ 90% on fixture repos
- [ ] Approval mode inference matches risk tier logic
- [ ] IR v2.0 hints populated from enterprise signals
- [ ] 20+ new tests, all passing
- [ ] `npm run typecheck` exits 0
- [ ] No regression in existing detection accuracy

---

## 4. Cross-References

| Concern | File | Status |
|---------|------|--------|
| IR schema for risk/settings | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Enterprise governance using signals | `06-ENTERPRISE-GOVERNANCE.md` | ⚠️ Partial |
| Templater risk-aware packs | `05-TEMPLATER-ENHANCEMENT.md` | ⚠️ Not started |

---

*Domain Spec: Detector Enhancement · open-blueprint v2.0*
