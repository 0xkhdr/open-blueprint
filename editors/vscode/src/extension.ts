import * as path from "path";
import { ExtensionContext, workspace } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // Point to our compiled LSP server
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
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
