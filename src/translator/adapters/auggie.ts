import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class AuggieAdapter extends MarkdownAdapter {
  protected config = getBackend("auggie");
}
