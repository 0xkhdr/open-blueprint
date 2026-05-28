import * as fs from "node:fs";
import * as path from "node:path";
import {
  type CodeAction,
  CodeActionKind,
  createConnection,
  type Diagnostic,
  DiagnosticSeverity,
  type HoverParams,
  type Hover,
  type InitializeParams,
  type InitializeResult,
  type Position,
  type CompletionParams,
  type CompletionItem,
  CompletionItemKind,
  type DefinitionParams,
  type Definition,
  type LocationLink,
  ProposedFeatures,
  type SymbolInformation,
  TextDocumentSyncKind,
  TextDocuments,
  SymbolKind,
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
      hoverProvider: true,
      completionProvider: { resolveProvider: false, triggerCharacters: ['"', ":"] },
      definitionProvider: true,
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

function getLineContent(document: TextDocument, line: number): string {
  const text = document.getText();
  const lines = text.split("\n");
  return lines[line] || "";
}

function extractFrontmatterFieldAtPosition(document: TextDocument, line: number, character: number): string | null {
  const lineContent = getLineContent(document, line);
  const match = lineContent.match(/^\s*(\w+)\s*:/);
  return match?.[1] ?? null;
}

function findAllBlueprints(projectRoot: string): Map<string, { id: string; file: string }> {
  const blueprints = new Map<string, { id: string; file: string }>();
  const scanDir = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && (entry.name === ".claude")) {
          const rulesDir = path.join(fullPath, "rules");
          if (fs.existsSync(rulesDir)) {
            const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
            for (const file of ruleFiles) {
              const filePath = path.join(rulesDir, file);
              const content = fs.readFileSync(filePath, "utf-8");
              const match = content.match(/^id:\s*["']?([^"'\n]+)["']?/m);
              if (match?.[1]) {
                blueprints.set(match[1], { id: match[1], file: filePath });
              }
            }
          }
          const skillsDir = path.join(fullPath, "skills");
          if (fs.existsSync(skillsDir)) {
            const skillFiles = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
            for (const file of skillFiles) {
              const filePath = path.join(skillsDir, file);
              const content = fs.readFileSync(filePath, "utf-8");
              const match = content.match(/^name:\s*["']?([^"'\n]+)["']?/m);
              if (match?.[1]) {
                blueprints.set(match[1], { id: match[1], file: filePath });
              }
            }
          }
        } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
          scanDir(fullPath);
        }
      }
    } catch {
      // Ignore read errors
    }
  };
  scanDir(projectRoot);
  return blueprints;
}

// Hover documentation
connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
  const { textDocument, position } = params;
  const document = documents.get(textDocument.uri);
  if (!document) return null;

  const field = extractFrontmatterFieldAtPosition(document, position.line, position.character);
  if (!field) return null;

  const docs: Record<string, string> = {
    scope: "Glob pattern(s) that define which files this rule applies to. Examples: `**/*.ts`, `.claude/rules/**`",
    severity: "Rule severity level. `hard` = strict enforcement (read-only approval), `soft` = advisory (auto approval)",
    action: "Description of what should be done when this rule is triggered. Be specific about the expected behavior.",
    tags: "Comma-separated list of categories/tags for organizing and filtering rules.",
    id: "Unique identifier for this rule. Used in conflict resolution and cross-references.",
    when_to_use: "Clear description of when and why to use this skill or agent. Include prerequisites.",
    tools_required: "List of tools or APIs that must be available for this skill/agent to function.",
    name: "Display name for this skill, agent, or component. Should be clear and memorable.",
    description: "Brief description of purpose and primary function.",
    role: "Agent role: Developer, Reviewer, Ops, Analyst, etc. Defines primary responsibilities.",
    constraints: "List of constraints or limitations on agent behavior. Examples: budget limits, approval scopes.",
    allowed_tools: "Tools and capabilities this agent is permitted to use.",
    rationale: "Explanation of why this rule, skill, or configuration exists. Include any context or decisions.",
  };

  if (docs[field]) {
    return {
      contents: docs[field],
    };
  }

  return null;
});

// Completions
connection.onCompletion(async (params: CompletionParams): Promise<CompletionItem[]> => {
  const { textDocument, position } = params;
  const document = documents.get(textDocument.uri);
  if (!document) return [];

  const line = getLineContent(document, position.line);
  const beforeCursor = line.substring(0, position.character);

  const items: CompletionItem[] = [];

  // Frontmatter key completion
  if (beforeCursor.includes("---") && !beforeCursor.match(/:\s*['"]/)) {
    const frontmatterKeys = [
      "id",
      "scope",
      "severity",
      "action",
      "tags",
      "rationale",
      "name",
      "description",
      "when_to_use",
      "tools_required",
      "role",
      "constraints",
      "allowed_tools",
    ];
    for (const key of frontmatterKeys) {
      items.push({
        label: key,
        kind: CompletionItemKind.Field,
        insertText: `${key}: `,
        detail: "Frontmatter field",
      });
    }
  }

  // Value completion for severity
  if (beforeCursor.match(/severity\s*:\s*$/)) {
    items.push({
      label: "hard",
      kind: CompletionItemKind.Value,
      detail: "Strict enforcement (read-only approval required)",
    });
    items.push({
      label: "soft",
      kind: CompletionItemKind.Value,
      detail: "Advisory (auto-approved)",
    });
  }

  // Special markers
  if (beforeCursor.includes("<!--")) {
    items.push({
      label: " bp:preserve -->",
      kind: CompletionItemKind.Snippet,
      insertText: " bp:preserve -->",
      detail: "Preserve block marker",
    });
  }

  return items;
});

// Go to definition
connection.onDefinition(async (params: DefinitionParams): Promise<Definition | null> => {
  const { textDocument, position } = params;
  const document = documents.get(textDocument.uri);
  if (!document) return null;

  const projectRoot = findProjectRoot(document.uri.startsWith("file://") ? new URL(document.uri).pathname : document.uri);
  if (!projectRoot) return null;

  const blueprints = findAllBlueprints(projectRoot);
  const line = getLineContent(document, position.line);

  // Check if on a rule/skill ID reference (e.g., in conflict_resolution)
  const match = line.match(/["']([^"']+)["']/);
  if (match?.[1]) {
    const id = match[1];
    const blueprint = blueprints.get(id);
    if (blueprint) {
      return {
        uri: `file://${blueprint.file}`,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 0 },
        },
      };
    }
  }

  return null;
});

// Workspace symbols
connection.onWorkspaceSymbol(async (_params): Promise<SymbolInformation[]> => {
  const symbols: SymbolInformation[] = [];
  const workspaceFolders = _params;

  // For now, return empty. Full implementation would require workspace folder info
  // from InitializeParams to scan project blueprints.
  return symbols;
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
