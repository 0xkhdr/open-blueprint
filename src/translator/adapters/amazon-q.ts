import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class AmazonQAdapter extends MarkdownAdapter {
  protected config = getBackend("amazon-q");
}
