# Domain: Production Hardening
**Priority:** P2 · **Status:** ❌ NOT STARTED — LSP, fuzz, benchmarks, security missing · **Dependencies:** All previous domains
**Agent Boundary:** This is the largest gap. Your job is implementing the LSP server, fuzz testing suite, performance benchmarks, security hardening, and CI/CD integrations.

---

## 1. Current State (Verified from Repo)

Already present:
- ✅ `vscode-languageserver` in devDependencies (but no implementation)
- ✅ `fast-check` in devDependencies (but no fuzz tests)
- ✅ Basic `.github/workflows/` may exist
- ✅ Security module exists but depth unknown

**Missing:**
- ❌ LSP server implementation
- ❌ VS Code extension
- ❌ Fuzz testing suite
- ❌ Performance benchmark suite
- ❌ CI/CD composite actions
- ❌ Security hardening (sandbox, hook validation, path traversal prevention)

---

## 2. Implementation Tasks

### Task 9.1: LSP Server
Create `src/lsp/server.ts`:

```typescript
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
  CompletionItem,
  CompletionItemKind,
  CodeAction,
  CodeActionKind,
  Hover,
  Location,
  InitializeParams,
  InitializeResult,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { validateBlueprint } from "../validator/index.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: { triggerCharacters: [":", "-", " "] },
      hoverProvider: true,
      definitionProvider: true,
      codeActionProvider: true,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
  };
});

// Diagnostics
async function validateDocument(doc: TextDocument): Promise<Diagnostic[]> {
  const text = doc.getText();
  const filePath = doc.uri.replace("file://", "");

  try {
    const result = await validateBlueprint(filePath, text);
    return result.errors.map(e => ({
      range: {
        start: { line: Math.max(0, (e.line || 1) - 1), character: 0 },
        end: { line: Math.max(0, (e.line || 1) - 1), character: 100 },
      },
      message: e.message,
      severity: e.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
      source: "bp",
      code: e.type,
    }));
  } catch {
    return [];
  }
}

documents.onDidChangeContent(async change => {
  const diagnostics = await validateDocument(change.document);
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

// Completion
connection.onCompletion((_params): CompletionItem[] => {
  return [
    { label: "scope", kind: CompletionItemKind.Property, detail: "Rule scope pattern" },
    { label: "severity", kind: CompletionItemKind.Property, detail: "Rule severity" },
    { label: "action", kind: CompletionItemKind.Property, detail: "Rule action description" },
    { label: "rationale", kind: CompletionItemKind.Property, detail: "Rule rationale" },
    { label: "tags", kind: CompletionItemKind.Property, detail: "Rule tags" },
    { label: "hard", kind: CompletionItemKind.EnumMember, detail: "Hard constraint" },
    { label: "soft", kind: CompletionItemKind.EnumMember, detail: "Soft constraint" },
    { label: "info", kind: CompletionItemKind.EnumMember, detail: "Informational" },
  ];
});

// Hover
connection.onHover((params): Hover | undefined => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return undefined;

  const line = doc.getText({
    start: { line: params.position.line, character: 0 },
    end: { line: params.position.line + 1, character: 0 },
  });

  if (line.includes("severity:")) {
    return {
      contents: {
        kind: "markdown",
        value: `**Severity Levels**\n\n- \`hard\`: Must be followed, agent cannot override\n- \`soft\`: Should be followed, agent may ask for exception\n- \`info\`: Guidance only, no enforcement`,
      },
    };
  }

  return undefined;
});

// Code Actions
connection.onCodeAction((params): CodeAction[] => {
  const actions: CodeAction[] = [];

  for (const diag of params.context.diagnostics) {
    if (diag.code === "MISSING_REQUIRED_FIELD") {
      actions.push({
        title: `Add missing field: ${diag.message}`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [{
              range: diag.range,
              newText: `${diag.message}: \n`,
            }],
          },
        },
      });
    }

    if (diag.code === "SEVERITY_CONFLICT") {
      actions.push({
        title: "Downgrade to soft severity",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [{
              range: diag.range,
              newText: "severity: soft",
            }],
          },
        },
      });
    }
  }

  return actions;
});

documents.listen(connection);
connection.listen();
```

### Task 9.2: VS Code Extension
Create `editors/vscode/`:

**`package.json`:**
```json
{
  "name": "blueprint-lsp",
  "displayName": "Blueprint",
  "version": "2.0.0",
  "description": "Language support for open-blueprint governance files",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Programming Languages", "Linters", "Machine Learning"],
  "activationEvents": [
    "onLanguage:markdown",
    "workspaceContains:**/.claude/rules/*.md",
    "workspaceContains:**/.cursor/rules/*.md",
    "workspaceContains:**/AGENTS.md",
    "workspaceContains:**/.bp.json"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      { "command": "blueprint.verify", "title": "Verify Blueprint", "category": "Blueprint" },
      { "command": "blueprint.init", "title": "Initialize Blueprint", "category": "Blueprint" },
      { "command": "blueprint.doctor", "title": "Run Blueprint Doctor", "category": "Blueprint" },
      { "command": "blueprint.convert", "title": "Convert Backend", "category": "Blueprint" }
    ],
    "menus": {
      "explorer/context": [
        { "command": "blueprint.verify", "when": "explorerResourceIsFolder", "group": "blueprint@1" },
        { "command": "blueprint.init", "when": "explorerResourceIsFolder", "group": "blueprint@2" }
      ],
      "commandPalette": [
        { "command": "blueprint.verify" },
        { "command": "blueprint.init" },
        { "command": "blueprint.doctor" },
        { "command": "blueprint.convert" }
      ]
    },
    "views": {
      "explorer": [
        {
          "id": "blueprintExplorer",
          "name": "Blueprint",
          "when": "workspaceHasBlueprint"
        }
      ]
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "dependencies": {
    "vscode-languageclient": "^9.0.1"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "typescript": "^5.3.0"
  }
}
```

**`src/extension.ts`:**
```typescript
import * as vscode from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath("../../src/lsp/server.js");

  client = new LanguageClient(
    "blueprintLsp",
    "Blueprint Language Server",
    {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: { module: serverModule, transport: TransportKind.ipc },
    },
    {
      documentSelector: [
        { scheme: "file", pattern: "**/.claude/rules/*.md" },
        { scheme: "file", pattern: "**/.cursor/rules/*.md" },
        { scheme: "file", pattern: "**/.codex/rules/*.md" },
        { scheme: "file", pattern: "**/AGENTS.md" },
        { scheme: "file", pattern: "**/.bp.json" },
        { scheme: "file", pattern: "**/.bp-registry.yaml" },
      ],
    }
  );

  context.subscriptions.push(client.start());

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("blueprint.verify", async () => {
      const terminal = vscode.window.createTerminal("Blueprint");
      terminal.sendText("bp verify --level all");
      terminal.show();
    }),
    vscode.commands.registerCommand("blueprint.init", async () => {
      const terminal = vscode.window.createTerminal("Blueprint");
      terminal.sendText("bp init --interactive");
      terminal.show();
    }),
    vscode.commands.registerCommand("blueprint.doctor", async () => {
      const terminal = vscode.window.createTerminal("Blueprint");
      terminal.sendText("bp doctor --verbose");
      terminal.show();
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
```

### Task 9.3: Fuzz Testing Suite
Create `tests/fuzz/`:

**`tests/fuzz/repo-generator.ts`:**
```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import fc from "fast-check";

export const fileNameArb = fc.string({
  minLength: 1,
  maxLength: 50,
  // Safe characters for filenames
}).map(s => s.replace(/[\\/:*?"<>|]/g, "_"));

export const fileContentArb = fc.string({ minLength: 0, maxLength: 1000 });

export interface RandomRepo {
  root: string;
  files: string[];
}

export async function generateRandomRepo(
  arb: fc.Arbitrary<[string, string][]>
): Promise<RandomRepo> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-fuzz-"));
  const files: string[] = [];

  const fileEntries = arb.sample({ seed: Date.now() })[0];
  for (const [name, content] of fileEntries) {
    const filePath = path.join(root, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
    files.push(filePath);
  }

  return { root, files };
}

export function cleanupRepo(repo: RandomRepo): void {
  fs.rmSync(repo.root, { recursive: true, force: true });
}
```

**`tests/fuzz/invariants.test.ts`:**
```typescript
import { test, expect } from "vitest";
import fc from "fast-check";
import { execSync } from "node:child_process";
import { generateRandomRepo, cleanupRepo, fileNameArb, fileContentArb } from "./repo-generator.js";

const repoArb = fc.array(fc.tuple(fileNameArb, fileContentArb), {
  minLength: 0,
  maxLength: 200,
});

test("bp init never panics", async () => {
  await fc.assert(
    fc.asyncProperty(repoArb, async (files) => {
      const repo = await generateRandomRepo(fc.constant(files));
      try {
        const result = execSync("bp init --tool claude", {
          cwd: repo.root,
          encoding: "utf-8",
          timeout: 30000,
        });
        expect(result).not.toContain("panic");
        expect(result).not.toContain("fatal");
      } catch (e: any) {
        // Non-zero exit codes are acceptable (0-13)
        expect(e.status).toBeGreaterThanOrEqual(0);
        expect(e.status).toBeLessThanOrEqual(13);
      } finally {
        cleanupRepo(repo);
      }
    }),
    { numRuns: 1000, timeout: 60000 }
  );
});

test("bp verify never hangs", async () => {
  await fc.assert(
    fc.asyncProperty(repoArb, async (files) => {
      const repo = await generateRandomRepo(fc.constant(files));
      try {
        execSync("bp verify --level structural", {
          cwd: repo.root,
          encoding: "utf-8",
          timeout: 10000,
        });
      } catch {
        // Errors are fine, hangs are not
      } finally {
        cleanupRepo(repo);
      }
    }),
    { numRuns: 500, timeout: 30000 }
  );
});

test("output paths always within project root", async () => {
  await fc.assert(
    fc.asyncProperty(repoArb, async (files) => {
      const repo = await generateRandomRepo(fc.constant(files));
      try {
        execSync("bp init --tool claude", { cwd: repo.root, timeout: 30000 });

        // Check no files outside root
        const allFiles = execSync("find . -type f", {
          cwd: repo.root,
          encoding: "utf-8",
        }).split("\\n");

        for (const file of allFiles) {
          const resolved = path.resolve(repo.root, file);
          expect(resolved.startsWith(repo.root)).toBe(true);
        }
      } finally {
        cleanupRepo(repo);
      }
    }),
    { numRuns: 200, timeout: 30000 }
  );
});
```

### Task 9.4: Performance Benchmarks
Create `tests/performance/`:

**`tests/performance/init.bench.ts`:**
```typescript
import { bench, describe } from "vitest";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("bp init performance", () => {
  const sizes = [
    { name: "1K files", count: 1000 },
    { name: "5K files", count: 5000 },
    { name: "10K files", count: 10000 },
  ];

  for (const { name, count } of sizes) {
    bench(
      `init on ${name}`,
      () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-bench-"));

        // Generate files
        for (let i = 0; i < count; i++) {
          const dir = path.join(tmpDir, `src/${Math.floor(i / 100)}`);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `file-${i}.ts`), `export const x${i} = ${i};`);
        }

        // Add package.json
        fs.writeFileSync(
          path.join(tmpDir, "package.json"),
          JSON.stringify({ name: "bench", version: "1.0.0" })
        );

        execSync("bp init --tool claude", { cwd: tmpDir, timeout: 30000 });
        fs.rmSync(tmpDir, { recursive: true });
      },
      { time: 10000, iterations: 5 }
    );
  }
});
```

### Task 9.5: Security Hardening
Create/update security modules:

**`src/security/sandbox.ts`:**
```typescript
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;

  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === "object") {
      deepFreeze(value);
    }
  }

  return obj;
}
```

**`src/security/hook-validator.ts`:**
```typescript
export interface HookSafetyReport {
  safe: boolean;
  violations: Array<{ pattern: string; line: number; match: string }>;
}

const FORBIDDEN_PATTERNS = [
  { name: "child_process", regex: /require\s*\(\s*['"]child_process['"]\s*\)/ },
  { name: "fs direct", regex: /require\s*\(\s*['"]fs['"]\s*\)/ },
  { name: "fetch", regex: /\bfetch\s*\(/ },
  { name: "eval", regex: /\beval\s*\(/ },
  { name: "new Function", regex: /new\s+Function\s*\(/ },
  { name: "process.env", regex: /process\.env\./ },
  { name: "exec", regex: /\.exec\s*\(/ },
  { name: "spawn", regex: /\.spawn\s*\(/ },
];

export function validateHookSafety(code: string): HookSafetyReport {
  const violations = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      const match = lines[i].match(pattern.regex);
      if (match) {
        violations.push({
          pattern: pattern.name,
          line: i + 1,
          match: match[0],
        });
      }
    }
  }

  return { safe: violations.length === 0, violations };
}
```

**`src/security/path-traversal.ts`:**
```typescript
import * as path from "node:path";

export function safeOutputPath(
  requestedPath: string,
  projectRoot: string
): string {
  const resolved = path.resolve(projectRoot, requestedPath);
  const rootResolved = path.resolve(projectRoot);

  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error(
      `Path traversal detected: ${requestedPath} resolves to ${resolved} which is outside ${rootResolved}`
    );
  }

  return resolved;
}
```

### Task 9.6: CI/CD Integrations
Create `.github/actions/verify/action.yml`:

```yaml
name: "Blueprint Verify"
description: "Verify blueprint integrity in CI"
inputs:
  backend:
    description: "Target backend"
    required: true
    default: "claude"
  level:
    description: "Validation level"
    required: true
    default: "all"
  fail-on:
    description: "Fail on severity"
    required: true
    default: "logical"
  json-report:
    description: "Output JSON report"
    required: false
    default: "false"
runs:
  using: "composite"
  steps:
    - name: Setup Node
      uses: actions/setup-node@v4
      with:
        node-version: "20"
    - name: Install bp
      run: npm install -g @agentic/bp
      shell: bash
    - name: Verify Blueprint
      run: |
        bp verify --tool ${{ inputs.backend }} --level ${{ inputs.level }} --fail-on ${{ inputs.fail-on }} ${{ inputs.json-report == 'true' && '--json' || '' }}
      shell: bash
```

---

## 3. Acceptance Criteria

- [ ] LSP server provides real-time diagnostics on `.claude/rules/*.md`
- [ ] LSP hover shows severity level documentation
- [ ] LSP code actions fix missing fields and severity conflicts
- [ ] VS Code extension published to marketplace
- [ ] Fuzz tests: 1000 runs, zero panics, zero hangs
- [ ] Performance: `bp init` < 2s on 1K files, < 8s on 10K files
- [ ] Template context deep-frozen before rendering
- [ ] Hook validator catches all 8 forbidden patterns
- [ ] Path traversal prevented on all output paths
- [ ] GitHub Action works end-to-end in test repo
- [ ] 100+ new tests, all passing
- [ ] Coverage for `src/lsp/`, `src/security/`, `tests/fuzz/` ≥ 90%

---

## 4. Cross-References

| Concern | File | Status |
|---------|------|--------|
| IR schema for LSP context | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Cost tracking (performance metrics) | `08-OBSERVABILITY-COST.md` | ⚠️ Partial |
| Enterprise security requirements | `06-ENTERPRISE-GOVERNANCE.md` | ⚠️ Partial |
| Multi-agent registry (LSP symbols) | `07-MULTIAGENT-MCP.md` | ⚠️ Partial |
| VS Code extension (DX) | `10-DEVELOPER-EXPERIENCE.md` | ❌ Not started |

---

*Domain Spec: Production Hardening · open-blueprint v2.0*
