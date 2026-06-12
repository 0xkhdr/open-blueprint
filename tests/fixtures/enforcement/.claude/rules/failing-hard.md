---
id: fixture-failing-hard
scope: "**/*"
severity: hard
action: "Repository must contain a SECURITY.md"
rationale: "Security policy must be documented"
check:
  type: file-exists
  glob: "SECURITY.md"
---

# Failing hard rule
