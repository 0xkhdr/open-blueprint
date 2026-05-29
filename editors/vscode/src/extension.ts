import * as path from "path";
import * as vscode from "vscode";
import { ExtensionContext, workspace } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { BlueprintTreeProvider } from "./tree-view.js";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join("..", "..", "dist", "lsp", "index.js")
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "markdown", pattern: "**/CLAUDE.md" },
      { scheme: "file", language: "markdown", pattern: "**/.claude/rules/*.md" },
      { scheme: "file", language: "markdown", pattern: "**/.claude/skills/*.md" },
      { scheme: "file", language: "markdown", pattern: "**/.claude/agents/*.md" },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/.claude/**/*.{md,json}"),
    },
  };

  client = new LanguageClient(
    "openBlueprintLSP",
    "Open Blueprint Language Server",
    serverOptions,
    clientOptions
  );

  client.start();

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
  const treeProvider = new BlueprintTreeProvider(workspaceRoot);
  vscode.window.registerTreeDataProvider("blueprintExplorer", treeProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("blueprint.refreshExplorer", () => treeProvider.refresh())
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
