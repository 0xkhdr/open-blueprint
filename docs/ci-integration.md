# CI/CD Integrations for open-blueprint

Integrating `bp` into your CI/CD pipelines ensures that changes to rules, spatial anchors, or codebase topologies do not introduce contradictions or broken mappings.

---

## 1. GitHub Actions

Use the official composite action in your workflow file (e.g. `.github/workflows/blueprint-verify.yml`):

```yaml
name: Blueprint Integrity
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./actions/verify
        with:
          backend: claude
          level: all
          fail-on: logical        # exit non-zero on rule conflicts
          json-report: false
```

### Governance report with per-rule PR annotations (SARIF)

Add a job that gates on hard violations and uploads the report to GitHub code
scanning, so every PR gets per-rule annotations at the violating `file:line`
(see [Governance Reporting](governance-reporting.md)):

```yaml
  report:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22.x"
          cache: npm
      - run: npx @agentic/bp report --sarif report.sarif --fail-on hard
      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: report.sarif
          category: bp-report
```

`--fail-on soft` tightens the gate to soft violations too; `--fail-on none` makes the
job report-only. Exit codes: [troubleshooting](troubleshooting.md#bp-report-exit-codes).

---

## 2. GitLab CI/CD

Integrate `bp` into your `.gitlab-ci.yml` file using a Node-based job:

```yaml
stages:
  - lint

blueprint-verify:
  stage: lint
  image: node:20-alpine
  script:
    - npx @agentic/bp verify --level all --fail-on logical
  only:
    changes:
      - .claude/**/*
      - CLAUDE.md
      - .bp.json
```

---

## 3. Azure DevOps

Add the verification task to your Azure Pipelines YAML pipeline (`azure-pipelines.yml`):

```yaml
trigger:
  - main

jobs:
  - job: VerifyBlueprint
    pool:
      vmImage: 'ubuntu-latest'
    steps:
      - task: NodeTool@0
        inputs:
          versionSpec: '20.x'
        displayName: 'Install Node.js'

      - script: |
          npx @agentic/bp verify --level all --fail-on logical
        displayName: 'Run blueprint verify'
```
