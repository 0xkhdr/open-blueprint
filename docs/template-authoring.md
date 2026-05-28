# open-blueprint (`bp`) — Template Authoring Guide

This guide details how to author, package, sign, and distribute custom **blueprint template packs** for `bp`.

---

## 1. Directory Structure of a Template Pack

A blueprint template pack contains Handlebars (`.hbs`) files organized to match the standard blueprint directory layout.

A standard template pack structure:

```
my-custom-pack/
├── manifest.json.hbs
├── CLAUDE.md.hbs
└── .claude/
    ├── agents/
    │   ├── planner.md.hbs
    │   └── implementer.md.hbs
    ├── rules/
    │   ├── style-conventions.md.hbs
    │   └── security-policies.md.hbs
    └── skills/
        ├── write-test.md.hbs
        └── database-migrations.md.hbs
```

---

## 2. Dynamic Templates with Handlebars

`bp` utilizes logic-less **Handlebars** syntax. During rendering, the compiler receives the deterministic `Fingerprint` context compiled by the Detector engine.

### 2.1 The Render Context
Your templates can bind to any field in the standard `TemplateContext` object:

| Variable | Type | Description |
| :--- | :--- | :--- |
| `project_name` | `string` | The clean name of the repository. |
| `project_type` | `string` | `monorepo`, `polyrepo`, `library`, `application`, or `service`. |
| `primary_language` | `string` | e.g., `typescript`, `python`, `go`, `rust`. |
| `primary_framework` | `string` | e.g., `nestjs`, `express`, `fastapi`, `django`. |
| `entry_point_path` | `string` | Primary entry point path determined by Detector. |
| `test_command` | `string` | Executable test script (e.g. `npm run test`). |
| `test_runner` | `string` | Active test runner (e.g. `vitest`, `pytest`). |
| `package_manager` | `string` | `npm`, `pnpm`, `yarn`, `bun`, `poetry`, etc. |
| `build_tool` | `string` | Detected compiler or bundler (e.g. `vite`, `webpack`). |
| `linter` | `string` | Active static analyzer (e.g. `biome`, `eslint`). |
| `ci_system` | `string` | Target CI/CD suite (e.g. `github-actions`, `gitlab-ci`). |
| `git_workflow` | `string` | Primary git stream (e.g. `github-flow`, `trunk-based`). |
| `has_auth` | `boolean` | Signal presence of authentication modules. |
| `has_external_apis` | `boolean` | Signal presence of HTTP/gRPC external clients. |
| `has_docker` | `boolean` | Signal presence of Dockerfiles or compose configs. |
| `src_dirs` | `string[]` | Array of source code directory roots. |
| `test_dirs` | `string[]` | Array of testing directory roots. |

---

### 2.2 Handlebars Context Syntax Examples

#### 1. Conditional Blocks
Use conditional bindings to generate custom rules for security or docker environments:

```markdown
# Entry point: {{entry_point_path}}
{{#if has_docker}}
## Docker Rules
* Ensure that docker containers never run with root privileges.
* All custom images must base on official alpine distributions.
{{/if}}
```

#### 2. Array Iteration
Iterate over topological directories or active languages to list boundaries:

```markdown
# Monitored Directories
{{#each src_dirs}}
* Directory: [{{this}}](./{{this}}) must follow standard conventions.
{{/each}}
```

#### 3. Base Partials Registration
`bp` registers core helper partials located in `templates/_base/partials`. You can include shared standard rules by embedding partial blocks:

```markdown
{{> base_style_rules}}
```

---

## 3. Merge Stability and Block Demarcations

To prevent successive `bp init` or `bp verify` sweeps from wiping custom adjustments written by developers, you must write template packs using **merge boundaries**.

### 3.1 Overwritable Blocks (`bp-generated`)
Wrap boilerplate and structural sections inside a `bp-generated` demarcator tagged with a unique identifier:

```markdown
<!-- bp-generated:begin metadata -->
# Project Topology: {{project_name}}
* Type: {{project_type}}
* Linter: {{linter}}
<!-- bp-generated:end metadata -->
```

### 3.2 Safe Developer Customizations
Instruct developers to write their custom rules, local command shortcuts, and workflow modifications inside `bp:preserve` blocks:

```markdown
<!-- bp:preserve -->
# Team Custom Rules
* All billing routes must be logged with correlation UUIDs.
<!-- bp:end-preserve -->
```

During execution, the Templater's `merger.ts` will parse the pre-existing file on disk, extract all content inside the `bp:preserve` boundary, re-render the `bp-generated` segments using the updated fingerprint, and stitch the preserve blocks back in safely.

---

## 4. Blueprint Inheritance

Organizations can enforce standardized compliance rules and coding conventions globally by establishing blueprint inheritance.

1. Publish a master template pack containing general corporate security rules (e.g. `@acme/base-blueprint`).
2. Downstream repositories implement inheritance by adding the `extends` keyword inside their `.bp.json` configuration file:

```json
{
  "extends": "@acme/base-blueprint",
  "backend": "claude"
}
```

3. When `bp init` runs, it will first pull and render the parent template rules, then compile the local template rules, and merge the two structures together.

---

## 5. Cryptographic Packaging & Signing

To secure templates and protect teams from malicious supply-chain prompt-injections, `bp` implements a cryptographic template signing system.

```
       [Raw Template Folder]
                 │
                 ▼
       [Pack Archive (JSON)]
                 │
   (Private RSA Key) ──► [signData] ──► SHA256 Signature
                 │
                 ▼
   [Registry Package Archive] (Base64 + Signature)
                 │
                 ▼
          Registry Client
```

### 5.1 Keypair Generation
Authors generate a standard 2048-bit RSA key pair:

```javascript
import { generateKeyPair } from "./signer.js";

const { publicKey, privateKey } = generateKeyPair();
// Keep the privateKey private. Share the publicKey with consumers.
```

### 5.2 Signing and Publishing
When publishing a pack via `RegistryClient.publish(packageName, version, packDir, privateKey)`, the engine:
1. Compiles the folder's file structures into a single payload buffer.
2. Generates a SHA256 signature of the payload using the author's private RSA key.
3. Packages the archive into a Base64-encoded string and publishes it along with the signature.

### 5.3 Verification and Unpacking
When installing a package using `RegistryClient.install(packageName, targetDir, publicKey)`:
1. The client downloads the Base64 package data and signature.
2. It hashes the payload and validates it using `verifySignature(payload, signature, publicKey)`.
3. If verification fails (e.g. the signature was invalid or the archive was altered), `bp` throws a terminal diagnostic error and halts execution, blocking untrusted code generation.
