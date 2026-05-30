import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import {
  type CodeAction,
  CodeActionKind,
  type CompletionItem,
  CompletionItemKind,
  type Diagnostic,
  DiagnosticSeverity,
  type Hover,
  type InitializeParams,
  type InitializeResult,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { detect, enrichFingerprint } from "../detector/index.js";
import { resolveTemplatePack } from "../templater/selector.js";
import { runValidator } from "../validator/index.js";

import { createConnection } from "vscode-languageserver/lib/node/main.js";

const connection = createConnection();
const documents = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: { triggerCharacters: [":", "-", " "] },
      hoverProvider: true,
      codeActionProvider: true,
    },
  };
});

async function validateDocument(doc: TextDocument): Promise<Diagnostic[]> {
  const filePath = doc.uri.replace("file://", "");
  const projectRoot = await findProjectRoot(filePath);

  try {
    const raw = await detect(projectRoot);
    const fingerprint = enrichFingerprint(raw);
    const pack = resolveTemplatePack(fingerprint, "claude");
    const result = await runValidator({
      level: "all",
      projectRoot,
      manifest: pack.manifest,
      fingerprint,
    });

    const allErrors = [...result.errors, ...result.warnings, ...result.infos];
    const basename = path.basename(filePath);

    return allErrors
      .filter((e) => e.file === filePath || path.basename(e.file) === basename)
      .map((e) => ({
        range: {
          start: { line: Math.max(0, (e.line ?? 1) - 1), character: 0 },
          end: { line: Math.max(0, (e.line ?? 1) - 1), character: 200 },
        },
        message: e.message,
        severity:
          e.severity === "error"
            ? DiagnosticSeverity.Error
            : e.severity === "warning"
              ? DiagnosticSeverity.Warning
              : DiagnosticSeverity.Information,
        source: "bp",
        code: e.type,
      }));
  } catch {
    return [];
  }
}

async function findProjectRoot(filePath: string): Promise<string> {
  let dir = path.dirname(filePath);
  while (dir !== path.dirname(dir)) {
    const [hasPkg, hasBp] = await Promise.all([
      fsPromises.access(path.join(dir, "package.json")).then(() => true).catch(() => false),
      fsPromises.access(path.join(dir, ".bp.json")).then(() => true).catch(() => false),
    ]);
    if (hasPkg || hasBp) return dir;
    dir = path.dirname(dir);
  }
  return path.dirname(filePath);
}

documents.onDidChangeContent(async (change: { document: TextDocument }) => {
  const diagnostics = await validateDocument(change.document);
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

connection.onCompletion((): CompletionItem[] => {
  return [
    { label: "scope", kind: CompletionItemKind.Property, detail: "Rule scope pattern" },
    { label: "severity", kind: CompletionItemKind.Property, detail: "Rule severity" },
    { label: "action", kind: CompletionItemKind.Property, detail: "Rule action description" },
    { label: "rationale", kind: CompletionItemKind.Property, detail: "Rule rationale" },
    { label: "tags", kind: CompletionItemKind.Property, detail: "Rule tags" },
    {
      label: "hard",
      kind: CompletionItemKind.EnumMember,
      detail: "Hard constraint — agent cannot override",
    },
    {
      label: "soft",
      kind: CompletionItemKind.EnumMember,
      detail: "Soft constraint — agent may request exception",
    },
    {
      label: "info",
      kind: CompletionItemKind.EnumMember,
      detail: "Informational — no enforcement",
    },
  ];
});

connection.onHover(
  (params: {
    textDocument: { uri: string };
    position: { line: number; character: number };
  }): Hover | undefined => {
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
          value:
            "**Severity Levels**\n\n- `hard`: Must be followed, agent cannot override\n- `soft`: Should be followed, agent may ask for exception\n- `info`: Guidance only, no enforcement",
        },
      };
    }

    if (line.includes("scope:")) {
      return {
        contents: {
          kind: "markdown",
          value:
            "**Scope Patterns**\n\nGlob patterns specifying which files this rule applies to.\n\nExample: `src/**/*.ts` or `**/*.test.*`",
        },
      };
    }

    return undefined;
  }
);

connection.onCodeAction(
  (params: {
    textDocument: { uri: string };
    context: { diagnostics: Diagnostic[] };
  }): CodeAction[] => {
    const actions: CodeAction[] = [];

    for (const diag of params.context.diagnostics) {
      if (diag.code === "MISSING_REQUIRED_FIELD") {
        actions.push({
          title: `Add missing field: ${diag.message}`,
          kind: CodeActionKind.QuickFix,
          diagnostics: [diag],
          edit: {
            changes: {
              [params.textDocument.uri]: [{ range: diag.range, newText: `${diag.message}: \n` }],
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
              [params.textDocument.uri]: [{ range: diag.range, newText: "severity: soft" }],
            },
          },
        });
      }
    }

    return actions;
  }
);

documents.listen(connection);
connection.listen();
