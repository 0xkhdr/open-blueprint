import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class ClineAdapter extends MarkdownAdapter {
  protected config = getBackend("cline");
}
