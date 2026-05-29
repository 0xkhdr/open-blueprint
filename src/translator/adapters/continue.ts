import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class ContinueAdapter extends MarkdownAdapter {
  protected config = getBackend("continue");
}
