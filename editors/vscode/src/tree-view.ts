import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

export class BlueprintTreeProvider implements vscode.TreeDataProvider<BlueprintItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BlueprintItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: BlueprintItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BlueprintItem): Thenable<BlueprintItem[]> {
    if (!element) {
      return Promise.resolve([
        new BlueprintItem("Rules", vscode.TreeItemCollapsibleState.Collapsed, "rules"),
        new BlueprintItem("Skills", vscode.TreeItemCollapsibleState.Collapsed, "skills"),
        new BlueprintItem("Agents", vscode.TreeItemCollapsibleState.Collapsed, "agents"),
        new BlueprintItem("Settings", vscode.TreeItemCollapsibleState.None, "settings"),
      ]);
    }

    if (element.type === "rules") return this.getRuleItems();
    if (element.type === "skills") return this.getSkillItems();
    if (element.type === "agents") return this.getAgentItems();

    return Promise.resolve([]);
  }

  private async getRuleItems(): Promise<BlueprintItem[]> {
    const rulesDir = path.join(this.workspaceRoot, ".claude", "rules");
    if (!fs.existsSync(rulesDir)) return [];

    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
    return files.map((f) => {
      const item = new BlueprintItem(f, vscode.TreeItemCollapsibleState.None, "rule-file");
      item.command = {
        command: "vscode.open",
        title: "Open Rule",
        arguments: [vscode.Uri.file(path.join(rulesDir, f))],
      };
      return item;
    });
  }

  private async getSkillItems(): Promise<BlueprintItem[]> {
    const skillsDir = path.join(this.workspaceRoot, ".claude", "skills");
    if (!fs.existsSync(skillsDir)) return [];

    const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
    return files.map((f) => {
      const item = new BlueprintItem(f, vscode.TreeItemCollapsibleState.None, "skill-file");
      item.command = {
        command: "vscode.open",
        title: "Open Skill",
        arguments: [vscode.Uri.file(path.join(skillsDir, f))],
      };
      return item;
    });
  }

  private async getAgentItems(): Promise<BlueprintItem[]> {
    const agentsDir = path.join(this.workspaceRoot, ".claude", "agents");
    if (!fs.existsSync(agentsDir)) return [];

    const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
    return files.map((f) => {
      const item = new BlueprintItem(f, vscode.TreeItemCollapsibleState.None, "agent-file");
      item.command = {
        command: "vscode.open",
        title: "Open Agent",
        arguments: [vscode.Uri.file(path.join(agentsDir, f))],
      };
      return item;
    });
  }
}

export class BlueprintItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: string
  ) {
    super(label, collapsibleState);
    this.tooltip = this.label;
    this.description = this.type;
  }
}
