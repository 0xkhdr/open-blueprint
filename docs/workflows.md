# 🔄 Workflow Patterns & Guides

Permalink: Workflow Patterns & Guides

This guide describes how to integrate **open-blueprint (`bp`)** into your day-to-day coding processes, team guidelines, and deployment pipelines.

---

## 📊 Workflow Pattern Table

Permalink: Workflow Pattern Table

Select the workflow pattern that matches your current goal:

| Pattern | Commands | Best For |
|---|---|---|
| **Quick Bootstrap** | `bp init` ➔ `bp verify` | New repository, solo developers, fast startup |
| **CI Governance** | `bp verify --level all --fail-on logical` | Automated code review, PR validation blocks |
| **Cross-Team Sync** | `bp convert --from claude --to cursor` | Teams using mixed IDE environments |
| **Enterprise Inherit** | `bp config set template_registry` ➔ `bp init` | Enforcing company-wide compliance rules |
| **Drift Remediation** | `bp sync --auto-apply` | Resyncing blueprints after topology or framework changes |

---

## 🗺️ Developer Pathways

Permalink: Developer Pathways

---

### ⚡ Quick Path (Individual Developer)

Permalink: Quick Path (Individual Developer)

Designed for speed and local automation. Ideal for individual developers coding with AI agents.

1. **Bootstrap**: Run `bp init claude` to generate local workspace guides.
2. **Local Verification**: Add `bp verify` to your pre-commit hooks.
3. **Execution**: Instruct your agent to follow the rules outlined in `CLAUDE.md`.
4. **Topology Shifts**: If you add new packages, run `bp sync` to re-align your fingerprint.

---

### 🏢 Expanded Path (Team & Enterprise)

Permalink: Expanded Path (Team & Enterprise)

Designed for scalability, consistent security rules, and absolute pipeline integrity.

```text
[Org Registry] ➔ [Private Base Template] ➔ [Developer Local Init] ➔ [CI Block on PR Gates]
```

1. **Policy Setup**: The platform team publishes `@org/security-base` containing mandatory security and styling rules.
2. **Repo Setup**: Individual repositories set `"extends": "@org/security-base"` in their `.bp.json`.
3. **Developer Flow**: Developers run `bp init` to inherit company rules alongside local overrides.
4. **CI Enforcement**: The build server blocks merges on any PR that fails the `logical` or `drift` verification dimensions.

---

## 🌳 Workflow Decision Tree

Permalink: Workflow Decision Tree

Use this simple logic flow to decide which command to execute:

```text
            Are you starting a new project?
                     /          \
                  (Yes)         (No)
                   /              \
         Run: bp init          Has the repository changed?
                                 /            \
                              (Yes)           (No)
                               /                \
                         Run: bp sync        Are you testing rules?
                                                /          \
                                             (Yes)         (No)
                                              /              \
                                       Run: bp verify      Refer to CLI help
```
