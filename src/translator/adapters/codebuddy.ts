import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class CodeBuddyAdapter extends MarkdownAdapter {
  protected config = getBackend("codebuddy");
}
