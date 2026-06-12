---
id: fixture-failing-soft
scope: "**/*"
severity: soft
action: "Repository should contain a CONTRIBUTING.md"
check:
  type: file-exists
  glob: "CONTRIBUTING.md"
---

# Failing soft rule
