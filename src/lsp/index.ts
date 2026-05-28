import * as fs from "node:fs";
import * as path from "node:path";
import {
  type CodeAction,
  CodeActionKind,
  createConnection,
  type Diagnostic,
  DiagnosticSeverity,
  type InitializeParams,
  type InitializeResult,
  ProposedFeatures,
  type SymbolInformation,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { detect } from "../detector/index.js";
import { resolveTemplatePack } from "../templater/selector.js";
import { runValidator } from "../validator/index.js";

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      codeActionProvider: true,
      workspaceSymbolProvider: true,
    },
  };
});

// Real-time linting on didOpen / didChange / didSave
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const uri = textDocument.uri;
  // Convert file:// URI to standard path safely
  let filePath = uri;
  if (uri.startsWith("file://")) {
    filePath = new URL(uri).pathname;
  }
  const projectRoot = findProjectRoot(filePath);

  if (!projectRoot) return;

  try {
    const fingerprint = await detect(projectRoot);
    const pack = resolveTemplatePack(fingerprint, "claude"); // Default backend

    const result = await runValidator({
      level: "all",
      projectRoot,
      manifest: pack.manifest,
      fingerprint,
    });

    const diagnostics: Diagnostic[] = [];

    // Filter errors that belong to this file
    const fileErrors = [...result.errors, ...result.warnings].filter(
      (e) => path.resolve(e.file) === path.resolve(filePath)
    );

    for (const err of fileErrors) {
      const line = err.line ? err.line - 1 : 0;
      diagnostics.push({
        severity: err.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
        range: {
          start: { line, character: 0 },
          end: { line, character: Number.MAX_SAFE_INTEGER },
        },
        message: `${err.message} (${err.resolution})`,
        source: "open-blueprint",
        code: err.type,
      });
    }

    connection.sendDiagnostics({ uri, diagnostics });
  } catch (_e) {
    // Suppress errors during editing to avoid crashing LSP
  }
}

function findProjectRoot(filePath: string): string | null {
  let dir = path.dirname(filePath);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".bp.json")) || fs.existsSync(path.join(dir, "CLAUDE.md"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

// Workspace symbols
connection.onWorkspaceSymbol(async (_params): Promise<SymbolInformation[]> => {
  // Mock symbol search returning workspace symbols for rules and skills
  return [];
});

// Quick-fixes
connection.onCodeAction((params) => {
  const codeActions: CodeAction[] = [];
  for (const diagnostic of params.context.diagnostics) {
    if (diagnostic.code === "MISSING_FRONTMATTER") {
      codeActions.push({
        title: "Add minimal frontmatter block",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 0, character: 0 },
                },
                newText: '---\nscope: "**/*"\nseverity: soft\naction: ""\n---\n\n',
              },
            ],
          },
        },
      });
    }
  }
  return codeActions;
});

documents.listen(connection);
connection.listen();
