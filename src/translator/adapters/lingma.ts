import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class LingmaAdapter extends MarkdownAdapter {
  protected config = getBackend("lingma");
}
