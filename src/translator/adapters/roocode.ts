import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class RooCodeAdapter extends MarkdownAdapter {
  protected config = getBackend("roocode");
}
