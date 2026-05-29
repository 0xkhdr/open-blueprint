import { getBackend } from "./registry.js";

export class CommandSyntaxAdapter {
  getInvocation(backendId: string, workflowId: string): string {
    const backend = getBackend(backendId);
    switch (backend.commandSyntax) {
      case "colon":
        return `/opsx:${workflowId}`;
      case "hyphen":
        return `/opsx-${workflowId}`;
      case "bare":
        return `/openspec-${workflowId}`;
      case "skill":
        return `/skill:openspec-${workflowId}`;
    }
  }
}
